const securityGatewayService = require("../services/securityGatewayService");

/**
 * AI Security Gateway Express Middleware.
 * Sits in front of incoming authentication and API endpoints,
 * evaluates behavioral threat vectors, manages blocklists, and logs security telemetry.
 */
const securityGatewayMiddleware = async (req, res, next) => {
  const ipAddress =
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.socket?.remoteAddress ||
    req.ip ||
    "127.0.0.1";

  const userAgent = req.headers["user-agent"] || "Unknown User-Agent";
  const path = req.originalUrl || req.url || "/";
  const httpMethod = req.method;
  const payloadBytes = parseInt(req.headers["content-length"] || "0", 10) || 0;
  const account = (req.body && req.body.email) ? req.body.email : "";

  // 1. Evaluate incoming request against AI Security Engine
  try {
    const evaluation = await securityGatewayService.evaluateRequest({
      ipAddress,
      userAgent,
      path,
      httpMethod,
      payloadBytes,
      account,
    });

    req.securityEvaluation = evaluation;
    res.setHeader("X-Security-Gateway-Status", evaluation.decision || "NORMAL");

    // 2. Block request if High Risk, Critical, or Blocklisted
    if (evaluation.action === "BLOCKED" || evaluation.decision === "HIGH_RISK" || evaluation.decision === "CRITICAL") {
      await securityGatewayService.logSecurityEvent({
        eventType: "GATEWAY_BLOCKED_REQUEST",
        severity: evaluation.severity || "HIGH",
        ipAddress,
        clientIdentifier: evaluation.clientIdentifier,
        userAgent,
        endpoint: path,
        httpMethod,
        userEmail: account,
        actionTaken: "BLOCKED",
        reason: evaluation.reason || "Suspicious traffic pattern blocked by security gateway",
        riskScore: evaluation.riskScore || 85,
        gatewayDecision: evaluation.decision,
      });

      // Dispatch alert email if targeted at a specific account
      if (account) {
        securityGatewayService.sendSecurityAlertEmailIfNeeded({
          userEmail: account,
          eventTitle: "Suspicious Traffic Blocked by Security Gateway",
          description: "Our AI Security Gateway detected and blocked high-risk or automated anomalous activity targeting your account.",
          ipAddress,
          device: userAgent,
          actionTaken: "Blocked by Gateway",
          isBlocked: true,
          recommendation: "Your account is secure and the suspicious request was blocked. If you suspect your account is at risk, consider changing your password.",
        }).catch((e) => console.error("[SecurityGateway] Async alert error:", e.message));
      }

      return res.status(403).json({
        success: false,
        message: "Request blocked by AI Security Gateway due to suspicious activity.",
        reason: evaluation.reason,
      });
    }
  } catch (evalErr) {
    console.warn("[SecurityGateway] Non-fatal evaluation error:", evalErr.message);
  }

  // 3. Post-response telemetry tracker
  res.on("finish", () => {
    try {
      const clientIdentifier = securityGatewayService.getClientIdentifier(ipAddress, userAgent);
      securityGatewayService.recordRequest({
        clientIdentifier,
        path,
        payloadBytes,
        status: res.statusCode,
        account,
      });
    } catch (e) {
      // safe fallback
    }
  });

  next();
};

module.exports = securityGatewayMiddleware;
