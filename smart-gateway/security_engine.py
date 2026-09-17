import hashlib
import time
import json
import logging
import os
import numpy as np
import redis
from sklearn.ensemble import IsolationForest
import joblib

from config import get_settings

logger = logging.getLogger("sentinel.security_engine")
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")

MODEL_FILE_PATH = "isolation_forest.joblib"

class SecurityEngine:
    def __init__(self):
        self.settings = get_settings()
        self.redis_client = None
        self._init_redis()
        self._init_model()

    def _init_redis(self):
        try:
            self.redis_client = redis.Redis(
                host=self.settings.REDIS_HOST,
                port=self.settings.REDIS_PORT,
                db=0,
                decode_responses=True,
                socket_connect_timeout=2,
                socket_timeout=2
            )
            self.redis_client.ping()
            logger.info("Connected to Redis successfully.")
        except Exception as e:
            logger.warning(f"Redis connection failed ({e}). Operating in graceful fallback mode.")
            self.redis_client = None

    def is_redis_connected(self) -> bool:
        if self.redis_client is None:
            return False
        try:
            return self.redis_client.ping()
        except Exception:
            return False

    def _init_model(self):
        if os.path.exists(MODEL_FILE_PATH):
            try:
                self.model = joblib.load(MODEL_FILE_PATH)
                logger.info("Loaded trained Isolation Forest model from disk.")
                return
            except Exception as e:
                logger.warning(f"Failed to load Isolation Forest model from disk ({e}). Training new model.")

        self.retrain_model()

    def retrain_model(self):
        """
        Trains Isolation Forest on baseline synthetic normal and anomalous behavioral vectors.
        Vector: [request_frequency, iat_variance, error_ratio, payload_size_delta]
        """
        np.random.seed(42)
        
        # Normal traffic: low frequency (1-5 req/10s), steady IAT, zero/low 4xx errors, modest payload delta
        normal_freq = np.random.uniform(1.0, 4.0, 300)
        normal_iat_var = np.random.uniform(0.1, 2.0, 300)
        normal_error = np.random.uniform(0.0, 0.1, 300)
        normal_delta = np.random.uniform(0.0, 500.0, 300)
        normal_data = np.column_stack([normal_freq, normal_iat_var, normal_error, normal_delta])

        # Anomalous traffic: rapid burst (15-50 req/10s), low IAT variance, high 4xx error ratio, huge payload variance
        anom_freq = np.random.uniform(15.0, 60.0, 50)
        anom_iat_var = np.random.uniform(0.0001, 0.05, 50)
        anom_error = np.random.uniform(0.5, 1.0, 50)
        anom_delta = np.random.uniform(2000.0, 50000.0, 50)
        anom_data = np.column_stack([anom_freq, anom_iat_var, anom_error, anom_delta])

        X = np.vstack([normal_data, anom_data])
        
        self.model = IsolationForest(
            contamination=0.05,
            random_state=42,
            n_estimators=100
        )
        self.model.fit(X)

        try:
            joblib.dump(self.model, MODEL_FILE_PATH)
            logger.info("Retrained and saved Isolation Forest model to disk.")
        except Exception as e:
            logger.error(f"Failed to save joblib model to disk: {e}")

    @staticmethod
    def generate_client_id(client_ip: str, user_agent: str) -> str:
        """
        Creates a privacy-conscious deterministic identifier using IP + User-Agent hashed with SHA-256.
        Returns first 16 hex characters.
        """
        client_raw = f"{client_ip}|{user_agent}"
        return hashlib.sha256(client_raw.encode("utf-8")).hexdigest()[:16]

    def is_blocked(self, client_id: str) -> tuple[bool, str, float]:
        """
        Checks if client_id is present in Redis blocklist.
        Returns (is_blocked, reason, anomaly_score)
        """
        if not self.is_redis_connected():
            return False, "", 0.0

        key = f"blocklist:{client_id}"
        try:
            data = self.redis_client.get(key)
            if data:
                block_info = json.loads(data)
                return True, block_info.get("reason", "Anomalous traffic"), block_info.get("anomaly_score", -1.0)
        except Exception as e:
            logger.error(f"Redis error checking blocklist for {client_id}: {e}")
            
        return False, "", 0.0

    def record_request_metrics(self, client_id: str, path: str, payload_size: int, status_code: int):
        """
        Records timestamped request metrics in Redis ZSET: client:logs:{client_id}
        Value format: {path}|{payload_size}|{status_code}
        Score: Unix timestamp (seconds float)
        Removes stale entries outside WINDOW_SIZE_SECONDS.
        """
        if not self.is_redis_connected():
            return

        now = time.time()
        key = f"client:logs:{client_id}"
        member = f"{path}|{payload_size}|{status_code}|{now}"

        try:
            pipe = self.redis_client.pipeline()
            pipe.zadd(key, {member: now})
            min_valid_timestamp = now - self.settings.WINDOW_SIZE_SECONDS
            pipe.zremrangebyscore(key, 0, min_valid_timestamp)
            pipe.expire(key, self.settings.WINDOW_SIZE_SECONDS * 2)
            pipe.execute()
        except Exception as e:
            logger.error(f"Failed to record request metrics in Redis for {client_id}: {e}")

    def extract_behavioral_features(self, client_id: str) -> tuple[np.ndarray, int]:
        """
        Extracts 4 behavioral features from active window requests in Redis ZSET:
        1. Request Frequency (f_r)
        2. Inter-Arrival Time Variance (sigma^2_iat)
        3. HTTP 4xx Error Ratio (R_error)
        4. Payload Size Delta (Delta_size)

        Returns (feature_vector [1, 4], request_count)
        """
        if not self.is_redis_connected():
            return np.array([[1.0, 0.0, 0.0, 0.0]]), 1

        key = f"client:logs:{client_id}"
        now = time.time()
        min_valid_timestamp = now - self.settings.WINDOW_SIZE_SECONDS

        try:
            # Clean stale logs and get valid active window records
            self.redis_client.zremrangebyscore(key, 0, min_valid_timestamp)
            records = self.redis_client.zrangebyscore(key, min_valid_timestamp, "+inf", withscores=True)
        except Exception as e:
            logger.error(f"Error reading Redis ZSET metrics for {client_id}: {e}")
            return np.array([[1.0, 0.0, 0.0, 0.0]]), 1

        request_count = len(records)
        if request_count == 0:
            return np.array([[0.0, 0.0, 0.0, 0.0]]), 0

        timestamps = []
        payload_sizes = []
        status_codes = []

        for member, score in records:
            parts = member.split("|")
            if len(parts) >= 3:
                try:
                    payload_size = int(parts[1])
                    status_code = int(parts[2])
                    timestamps.append(score)
                    payload_sizes.append(payload_size)
                    status_codes.append(status_code)
                except ValueError:
                    continue

        # Feature 1: Request Frequency
        f_r = float(request_count)

        # Feature 2: Inter-Arrival Time Variance
        if len(timestamps) > 1:
            sorted_ts = sorted(timestamps)
            iats = np.diff(sorted_ts)
            sigma2_iat = float(np.var(iats)) if len(iats) > 0 else 0.0
        else:
            sigma2_iat = 0.0

        # Feature 3: HTTP 4xx Error Ratio
        if len(status_codes) > 0:
            errors_4xx = sum(1 for code in status_codes if 400 <= code < 500)
            r_error = float(errors_4xx / len(status_codes))
        else:
            r_error = 0.0

        # Feature 4: Payload Size Delta
        if len(payload_sizes) > 0:
            delta_size = float(max(payload_sizes) - min(payload_sizes))
        else:
            delta_size = 0.0

        vector = np.array([[f_r, sigma2_iat, r_error, delta_size]])
        return vector, request_count

    def evaluate_and_block_if_anomalous(self, client_id: str) -> tuple[float, bool]:
        """
        Evaluates Isolation Forest model on client behavioral features.
        Safe Fallback: If request_count < 3, returns score 0.0 (CLEAN) to prevent false-positives.
        If score < ANOMALY_THRESHOLD, blocks client in Redis for BAN_DURATION_SECONDS.
        Returns (anomaly_score, is_anomalous)
        """
        features, request_count = self.extract_behavioral_features(client_id)

        # Safe fallback logic for low request count (warm-up)
        if request_count < 3:
            return 0.0, False

        try:
            # score_samples returns negative anomaly score (lower means more anomalous)
            raw_scores = self.model.score_samples(features)
            anomaly_score = float(raw_scores[0])
        except Exception as e:
            logger.error(f"Error evaluating Isolation Forest model: {e}")
            return 0.0, False

        is_anomalous = anomaly_score < self.settings.ANOMALY_THRESHOLD

        if is_anomalous and self.is_redis_connected():
            block_key = f"blocklist:{client_id}"
            block_payload = json.dumps({
                "reason": "Access denied due to detected anomalous traffic.",
                "anomaly_score": round(anomaly_score, 4),
                "timestamp": time.time()
            })
            try:
                self.redis_client.setex(
                    block_key,
                    self.settings.BAN_DURATION_SECONDS,
                    block_payload
                )
                logger.warning(f"BLOCKED client {client_id}! Anomaly Score: {anomaly_score:.4f} < Threshold {self.settings.ANOMALY_THRESHOLD}")
            except Exception as e:
                logger.error(f"Failed to write blocklist entry in Redis for {client_id}: {e}")

        return anomaly_score, is_anomalous

    def manual_unblock(self, client_id: str) -> bool:
        """Removes client_id from Redis blocklist."""
        if not self.is_redis_connected():
            return False

        key = f"blocklist:{client_id}"
        try:
            removed = self.redis_client.delete(key)
            return removed > 0
        except Exception as e:
            logger.error(f"Error unblocking client {client_id} in Redis: {e}")
            return False

    def get_security_events(self) -> list[dict]:
        """Returns list of active blocked clients from Redis blocklist."""
        if not self.is_redis_connected():
            return []

        events = []
        try:
            keys = self.redis_client.keys("blocklist:*")
            for k in keys:
                client_id = k.split("blocklist:")[1]
                ttl = self.redis_client.ttl(k)
                raw_data = self.redis_client.get(k)
                if raw_data:
                    data = json.loads(raw_data)
                    events.append({
                        "client_id": client_id,
                        "reason": data.get("reason"),
                        "anomaly_score": data.get("anomaly_score"),
                        "timestamp": data.get("timestamp"),
                        "remaining_ttl_seconds": ttl
                    })
        except Exception as e:
            logger.error(f"Error fetching security events from Redis: {e}")

        return events

    def get_client_metrics(self, client_id: str) -> dict:
        """Returns feature vector and active window records for specified client_id."""
        features, req_count = self.extract_behavioral_features(client_id)
        f_vec = features[0].tolist()
        
        return {
            "client_id": client_id,
            "request_count_in_window": req_count,
            "features": {
                "request_frequency": f_vec[0],
                "iat_variance": f_vec[1],
                "error_ratio": f_vec[2],
                "payload_size_delta": f_vec[3]
            }
        }
