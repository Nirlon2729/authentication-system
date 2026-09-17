import time
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, Header, HTTPException, Security, status
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from config import get_settings
from security_engine import SecurityEngine
from proxy import ReverseProxy

logger = logging.getLogger("sentinel.main")
settings = get_settings()

security_engine = SecurityEngine()
proxy_engine = ReverseProxy()

total_requests_processed = 0
total_anomalies_detected = 0

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("FastAPI Security Gateway starting up...")
    yield
    logger.info("FastAPI Security Gateway shutting down...")
    await proxy_engine.close()

app = FastAPI(
    title="SentinelAI - Smart Security Gateway",
    description="AI-Driven Behavioral Security Reverse Proxy Gateway for Authentication System",
    version="1.0.0",
    lifespan=lifespan
)

# CORS Middleware Setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_ORIGIN, "http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Client-Anomaly-Status", "X-Gateway-Latency-Sec"]
)

def verify_admin_key(x_admin_api_key: str = Header(None, alias="X-Admin-API-Key")):
    if not x_admin_api_key or x_admin_api_key != settings.ADMIN_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing X-Admin-API-Key header."
        )
    return x_admin_api_key

# ==============================
# Health Endpoint
# ==============================

@app.get("/health")
async def health_check():
    redis_status = "connected" if security_engine.is_redis_connected() else "fallback_mode"
    return {
        "status": "ok",
        "redis": redis_status,
        "ai_engine": "ready"
    }

# ==============================
# Admin API Endpoints
# ==============================

@app.get("/admin/status")
async def get_admin_status(admin_key: str = Security(verify_admin_key)):
    blocked_events = security_engine.get_security_events()
    return {
        "status": "active",
        "total_requests_processed": total_requests_processed,
        "total_anomalies_detected": total_anomalies_detected,
        "active_blocked_clients": len(blocked_events),
        "redis_connected": security_engine.is_redis_connected(),
        "ai_engine_ready": True,
        "configuration": {
            "window_size_seconds": settings.WINDOW_SIZE_SECONDS,
            "anomaly_threshold": settings.ANOMALY_THRESHOLD,
            "ban_duration_seconds": settings.BAN_DURATION_SECONDS,
            "backend_url": settings.BACKEND_URL
        }
    }

@app.get("/admin/security-events")
async def get_security_events(admin_key: str = Security(verify_admin_key)):
    events = security_engine.get_security_events()
    return {
        "total_blocked_clients": len(events),
        "events": events
    }

@app.get("/admin/client/{client_id}/metrics")
async def get_client_metrics(client_id: str, admin_key: str = Security(verify_admin_key)):
    metrics = security_engine.get_client_metrics(client_id)
    return metrics

@app.post("/admin/unblock/{client_id}")
async def unblock_client(client_id: str, admin_key: str = Security(verify_admin_key)):
    success = security_engine.manual_unblock(client_id)
    if success:
        return {"success": True, "message": f"Client {client_id} unblocked successfully."}
    else:
        return {"success": False, "message": f"Client {client_id} was not in blocklist or Redis unavailable."}

@app.post("/admin/retrain")
async def retrain_model(admin_key: str = Security(verify_admin_key)):
    security_engine.retrain_model()
    return {"success": True, "message": "Isolation Forest model retrained successfully."}

# ==============================
# Reverse Proxy & Security Catch-All
# ==============================

@app.api_route("/api/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"])
async def gateway_reverse_proxy(request: Request, path: str):
    global total_requests_processed, total_anomalies_detected

    # CORS Preflight handling
    if request.method == "OPTIONS":
        return JSONResponse(
            content={"status": "ok"},
            headers={
                "Access-Control-Allow-Origin": request.headers.get("origin", settings.FRONTEND_ORIGIN),
                "Access-Control-Allow-Credentials": "true",
                "Access-Control-Allow-Methods": "*",
                "Access-Control-Allow-Headers": "*"
            }
        )

    total_requests_processed += 1

    # 1. Generate privacy-conscious client identifier (IP + User-Agent SHA-256)
    client_ip = request.client.host if request.client else "127.0.0.1"
    user_agent = request.headers.get("user-agent", "unknown-client")
    client_id = SecurityEngine.generate_client_id(client_ip, user_agent)

    # 2. Check Redis blocklist
    is_blocked, reason, anomaly_score = security_engine.is_blocked(client_id)
    if is_blocked:
        logger.warning(f"Blocking request from banned client {client_id} ({path})")
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content={"detail": "Access denied due to detected anomalous traffic."},
            headers={
                "X-Client-Anomaly-Status": "BLOCKED",
                "X-Gateway-Latency-Sec": "0.000100"
            }
        )

    # 3. Extract request payload size
    body_bytes = await request.body()
    payload_size = len(body_bytes)

    # 4. Forward request to Node.js backend
    backend_response = await proxy_engine.forward_request(
        request=request,
        path=path,
        anomaly_status="CLEAN"
    )

    status_code = backend_response.status_code

    # 5. Record metrics in Redis
    security_engine.record_request_metrics(
        client_id=client_id,
        path=path,
        payload_size=payload_size,
        status_code=status_code
    )

    # 6. Extract behavioral features & evaluate Isolation Forest
    score, is_anomalous = security_engine.evaluate_and_block_if_anomalous(client_id)

    if is_anomalous:
        total_anomalies_detected += 1
        backend_response.headers["X-Client-Anomaly-Status"] = "FLAGGED"

    return backend_response

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=settings.GATEWAY_HOST,
        port=settings.GATEWAY_PORT,
        reload=True
    )
