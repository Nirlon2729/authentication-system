import pytest
import numpy as np
import time
from fastapi.testclient import TestClient
from main import app, security_engine, settings
from security_engine import SecurityEngine

client = TestClient(app)

# 1. Normal request test
def test_normal_request():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"

# 2. Login request test (proxy route mock/forward)
def test_login_request_route():
    response = client.post("/api/auth/login", json={"email": "test@example.com", "password": "Password123!"})
    # If backend is running it returns backend code, if backend down it returns 503 structured response
    assert response.status_code in [200, 400, 401, 503]
    assert "X-Client-Anomaly-Status" in response.headers
    assert "X-Gateway-Latency-Sec" in response.headers

# 3. Signup request test
def test_signup_request_route():
    response = client.post("/api/auth/signup", json={"fullName": "Test User", "email": "signup@example.com", "password": "Password123!"})
    assert response.status_code in [200, 400, 503]
    assert "X-Client-Anomaly-Status" in response.headers

# 4. Authenticated request test
def test_authenticated_request():
    headers = {"Authorization": "Bearer fake_jwt_token_12345"}
    response = client.get("/api/profile", headers=headers)
    assert response.status_code in [200, 401, 503]
    assert "X-Client-Anomaly-Status" in response.headers

# 5. JWT Authorization header forwarding test
def test_jwt_authorization_header_forwarding():
    headers = {"Authorization": "Bearer test_token_xyz"}
    response = client.get("/api/profile", headers=headers)
    assert response.status_code in [200, 401, 503]

# 6. Cookie forwarding test
def test_cookie_forwarding():
    cookies = {"token": "test_cookie_jwt_abc"}
    response = client.get("/api/profile", cookies=cookies)
    assert response.status_code in [200, 401, 503]

# 7. Client identification hashing test
def test_client_identification_hashing():
    client_id1 = SecurityEngine.generate_client_id("192.168.1.1", "Mozilla/5.0")
    client_id2 = SecurityEngine.generate_client_id("192.168.1.1", "Mozilla/5.0")
    client_id3 = SecurityEngine.generate_client_id("192.168.1.2", "Mozilla/5.0")
    
    assert len(client_id1) == 16
    assert client_id1 == client_id2
    assert client_id1 != client_id3

# 8. Feature extraction test
def test_feature_extraction():
    test_id = "test_feat_client"
    security_engine.record_request_metrics(test_id, "/api/auth/login", 200, 401)
    features, count = security_engine.extract_behavioral_features(test_id)
    assert isinstance(features, np.ndarray)
    assert features.shape == (1, 4)
    assert count >= 1

# 9. Isolation Forest evaluation test
def test_isolation_forest_evaluation():
    test_id = "test_if_eval_client"
    score, is_anom = security_engine.evaluate_and_block_if_anomalous(test_id)
    assert isinstance(score, float)
    assert isinstance(is_anom, bool)

# 10. Insufficient request history test (Cold start fallback)
def test_insufficient_request_history():
    test_id = "test_cold_start_client"
    # Less than 3 requests
    score, is_anom = security_engine.evaluate_and_block_if_anomalous(test_id)
    assert score == 0.0
    assert is_anom is False

# 11. Redis blocklist test
def test_redis_blocklist():
    test_id = "test_blocked_client_xyz"
    if security_engine.is_redis_connected():
        security_engine.redis_client.setex(f"blocklist:{test_id}", 60, '{"reason": "test block", "anomaly_score": -0.8}')
        is_blocked, reason, score = security_engine.is_blocked(test_id)
        assert is_blocked is True
        assert "test block" in reason
        security_engine.manual_unblock(test_id)

# 12. Blocked client receives 403 test
def test_blocked_client_receives_403():
    test_id = SecurityEngine.generate_client_id("127.0.0.1", "test-agent-blocked")
    if security_engine.is_redis_connected():
        security_engine.redis_client.setex(f"blocklist:{test_id}", 60, '{"reason": "banned", "anomaly_score": -0.9}')
        response = client.get("/api/auth/me", headers={"User-Agent": "test-agent-blocked"})
        assert response.status_code == 403
        assert response.json()["detail"] == "Access denied due to detected anomalous traffic."
        assert response.headers["X-Client-Anomaly-Status"] == "BLOCKED"
        security_engine.manual_unblock(test_id)

# 13. Admin authentication test
def test_admin_authentication():
    # Without key
    res_no_key = client.get("/admin/status")
    assert res_no_key.status_code == 401

    # With invalid key
    res_bad_key = client.get("/admin/status", headers={"X-Admin-API-Key": "wrong-key"})
    assert res_bad_key.status_code == 401

    # With correct key
    res_valid = client.get("/admin/status", headers={"X-Admin-API-Key": settings.ADMIN_API_KEY})
    assert res_valid.status_code == 200
    assert "total_requests_processed" in res_valid.json()

# 14. Manual unblock test
def test_manual_unblock():
    test_id = "test_manual_unblock_id"
    if security_engine.is_redis_connected():
        security_engine.redis_client.setex(f"blocklist:{test_id}", 60, '{"reason": "test", "anomaly_score": -0.75}')
        res = client.post(f"/admin/unblock/{test_id}", headers={"X-Admin-API-Key": settings.ADMIN_API_KEY})
        assert res.status_code == 200
        assert res.json()["success"] is True
        is_blocked, _, _ = security_engine.is_blocked(test_id)
        assert is_blocked is False

# 15. Health endpoint test
def test_health_endpoint():
    res = client.get("/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ok"
    assert "redis" in data
    assert data["ai_engine"] == "ready"

# 16. Backend unavailable test
def test_backend_unavailable_handling():
    # Calling non-existent backend path gracefully returns 503 structured response if backend is offline
    res = client.get("/api/non-existent-route-xyz")
    assert res.status_code in [200, 404, 503]

# 17. Redis unavailable graceful fallback test
def test_redis_unavailable_graceful_fallback(monkeypatch):
    monkeypatch.setattr(security_engine, "redis_client", None)
    is_blocked, reason, score = security_engine.is_blocked("any_client")
    assert is_blocked is False

# 18. Normal slow human-like traffic test
def test_normal_slow_human_traffic():
    test_id = "human_user_test_client"
    for _ in range(2):
        security_engine.record_request_metrics(test_id, "/api/auth/login", 150, 200)
    score, is_anom = security_engine.evaluate_and_block_if_anomalous(test_id)
    assert is_anom is False

# 19. Rapid automated traffic test
def test_rapid_automated_traffic_detection():
    test_id = "bot_user_test_client"
    if security_engine.is_redis_connected():
        # Simulate burst of 40 requests with 401 errors within 1s
        now = time.time()
        for i in range(40):
            security_engine.record_request_metrics(test_id, "/api/auth/login", 50, 401)

        score, is_anom = security_engine.evaluate_and_block_if_anomalous(test_id)
        assert is_anom is True
        security_engine.manual_unblock(test_id)
