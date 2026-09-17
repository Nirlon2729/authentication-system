import time
import logging
from fastapi import Request, Response
from fastapi.responses import Response as FastAPIResponse
import httpx

from config import get_settings

logger = logging.getLogger("sentinel.proxy")

class ReverseProxy:
    def __init__(self):
        self.settings = get_settings()
        self.client = httpx.AsyncClient(
            base_url=self.settings.BACKEND_URL,
            timeout=30.0,
            follow_redirects=False
        )

    async def close(self):
        await self.client.aclose()

    async def forward_request(
        self,
        request: Request,
        path: str,
        anomaly_status: str = "CLEAN"
    ) => FastAPIResponse:
        """
        Forwards incoming request to Node.js backend URL while preserving headers,
        JWT authorization tokens, cookies, content-type, origin, body, and query params.
        """
        start_time = time.time()

        # Build backend target URL
        target_url = f"/api/{path}" if path else "/api"

        # Prepare headers to forward without mutating authorization or cookies
        forward_headers = {}
        for header_name, header_value in request.headers.items():
            if header_name.lower() not in ["host", "content-length"]:
                forward_headers[header_name] = header_value

        # Read body content
        body_content = await request.body()

        # Extract query parameters
        query_params = dict(request.query_params)

        try:
            # Send HTTP proxy request to Node.js Express backend
            backend_response = await self.client.request(
                method=request.method,
                url=target_url,
                headers=forward_headers,
                params=query_params,
                content=body_content
            )

            latency = round(time.time() - start_time, 6)

            # Prepare response headers to send back to client
            response_headers = {}
            for h_name, h_val in backend_response.headers.items():
                if h_name.lower() not in ["content-encoding", "content-length", "transfer-encoding"]:
                    response_headers[h_name] = h_val

            # Add required security gateway headers
            response_headers["X-Client-Anomaly-Status"] = anomaly_status
            response_headers["X-Gateway-Latency-Sec"] = str(latency)

            return FastAPIResponse(
                content=backend_response.content,
                status_code=backend_response.status_code,
                headers=response_headers,
                media_type=backend_response.headers.get("content-type")
            )

        except httpx.ConnectError:
            logger.error(f"Backend Node.js service unavailable at {self.settings.BACKEND_URL}")
            latency = round(time.time() - start_time, 6)
            return FastAPIResponse(
                content='{"success": false, "message": "Backend authentication service currently unavailable."}',
                status_code=503,
                headers={
                    "Content-Type": "application/json",
                    "X-Client-Anomaly-Status": "FLAGGED",
                    "X-Gateway-Latency-Sec": str(latency)
                }
            )
        except httpx.TimeoutException:
            logger.error(f"Backend proxy timeout requesting {target_url}")
            latency = round(time.time() - start_time, 6)
            return FastAPIResponse(
                content='{"success": false, "message": "Gateway request timeout communicating with backend."}',
                status_code=504,
                headers={
                    "Content-Type": "application/json",
                    "X-Client-Anomaly-Status": "FLAGGED",
                    "X-Gateway-Latency-Sec": str(latency)
                }
            )
        except Exception as e:
            logger.error(f"Unexpected error in proxy forwarding to backend: {e}")
            latency = round(time.time() - start_time, 6)
            return FastAPIResponse(
                content='{"success": false, "message": "Internal gateway proxy error."}',
                status_code=500,
                headers={
                    "Content-Type": "application/json",
                    "X-Client-Anomaly-Status": "FLAGGED",
                    "X-Gateway-Latency-Sec": str(latency)
                }
            )
