const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const securityGatewayService = require("../services/securityGatewayService");
const {
  SECURITY_EVENT_TYPES,
  SEVERITY_LEVELS,
  GATEWAY_DECISIONS,
  GATEWAY_ACTIONS,
  CLIENT_TYPES,
  BLOCK_SOURCES,
} = require("../constants/securityEvents");

let User;
try {
  User = require("../models/User");
} catch (e) {
  User = null;
}

/**
 * AI Security Gateway Express Middleware.
 * Sits in front of incoming authentication and API endpoints,
 * evaluates behavioral threat vectors, manages blocklists, and logs security telemetry.
 *
 * Controlled Simulation Architecture:
 * Automatically recognizes verified simulation traffic via signed server-minted tokens.
 * Simulated attacks run under isolated synthetic identities (synthetic IP, UA, and client ID),
 * ensuring the administrator's real browser session and IP are never blocked.
 */
const securityGatewayMiddleware = async (req, res, next) => {
  // 1. Generate / Preserve Request Correlation ID
  const requestId = req.headers["x-request-id"] || crypto.randomUUID();
  req.id = requestId;
  res.setHeader("X-Request-ID", requestId);

  const rawIp =
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.socket?.remoteAddress ||
    req.ip ||
    "127.0.0.1";

  const rawUserAgent = req.headers["user-agent"] || "Unknown User-Agent";
  const path = req.originalUrl || req.url || "/";
  const httpMethod = req.method;
  const payloadBytes = parseInt(req.headers["content-length"] || "0", 10) || 0;
  const rawAccount = req.body && req.body.email ? String(req.body.email).toLowerCase().trim() : "";

  // Bypass gateway evaluation for OPTIONS preflight requests
  if (httpMethod === "OPTIONS") {
    return next();
  }

  // 1.5 Extract and evaluate authenticated user if JWT token is present
  let authenticatedUser = null;
  let token = null;
  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
    token = req.headers.authorization.split(" ")[1];
  } else if (req.cookies?.token || req.signedCookies?.token) {
    token = req.cookies?.token || req.signedCookies?.token;
  }

  if (token && process.env.JWT_SECRET && User) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (decoded && decoded.id) {
        authenticatedUser = await User.findById(decoded.id).select("-password");
        if (authenticatedUser) {
          const userBlockCheck = await securityGatewayService.checkUserBlocked(authenticatedUser);
          if (userBlockCheck.isBlocked) {
            return res.status(403).json({
              success: false,
              code: "USER_TEMPORARILY_BLOCKED",
              message: "Your account has been temporarily restricted due to suspicious activity.",
              blockedUntil: userBlockCheck.blockedUntil,
              remainingSeconds: userBlockCheck.remainingSeconds,
            });
          }
          req.authenticatedUser = authenticatedUser;
        }
      }
    } catch (tokenErr) {
      // Ignore unauthenticated or expired token here
    }
  }

  // 2. Derive effective network identity
  const ipAddress = rawIp;
  const userAgent = rawUserAgent;
  const account = rawAccount;
  const clientIdentifier = securityGatewayService.getClientIdentifier(ipAddress, userAgent);

  // 3. Evaluate request against AI Security Engine
  let evaluation = {
    decision: GATEWAY_DECISIONS.NORMAL,
    severity: SEVERITY_LEVELS.LOW,
    riskScore: 0,
    action: GATEWAY_ACTIONS.ALLOWED,
    reason: "Normal baseline traffic",
    clientIdentifier,
    clientType: CLIENT_TYPES.REAL,
    isSimulation: false,
  };

  try {
    evaluation = await securityGatewayService.evaluateRequest({
      ipAddress,
      userAgent,
      path,
      httpMethod,
      payloadBytes,
      account,
      requestId,
      clientType: CLIENT_TYPES.REAL,
      isSimulation: false,
    });

    req.securityEvaluation = evaluation;
    res.setHeader("X-Security-Gateway-Status", evaluation.decision || "NORMAL");
    res.setHeader("X-Security-Risk-Score", String(evaluation.riskScore || 0));

    // 4. Enforce blocking if High Risk, Critical, or Blocklisted
    if (
      evaluation.action === GATEWAY_ACTIONS.BLOCKED ||
      evaluation.decision === GATEWAY_DECISIONS.HIGH_RISK ||
      evaluation.decision === GATEWAY_DECISIONS.CRITICAL
    ) {
      await securityGatewayService.logSecurityEvent({
        eventType: SECURITY_EVENT_TYPES.GATEWAY_BLOCKED_REQUEST,
        severity: evaluation.severity || SEVERITY_LEVELS.HIGH,
        requestId,
        ipAddress,
        clientIdentifier: evaluation.clientIdentifier,
        userAgent,
        endpoint: path,
        httpMethod,
        httpStatus: 403,
        userEmail: account,
        actionTaken: GATEWAY_ACTIONS.BLOCKED,
        reason: evaluation.reason || "Automated anomalous traffic detected and blocked by the security gateway.",
        riskScore: evaluation.riskScore || 85,
        gatewayDecision: evaluation.decision,
        isSimulation: false,
        clientType: CLIENT_TYPES.REAL,
      });

      // Dispatch alert email for production accounts
      if (account) {
        securityGatewayService
          .sendSecurityAlertEmailIfNeeded({
            userEmail: account,
            eventTitle: "Suspicious Traffic Blocked by Security Gateway",
            description:
              "Our AI Security Gateway detected and blocked high-risk or automated anomalous activity targeting your account.",
            ipAddress,
            device: userAgent,
            actionTaken: "Blocked by Gateway",
            isBlocked: true,
            recommendation:
              "Your account is secure and the suspicious request was blocked. If you suspect your account is at risk, consider changing your password.",
            isSimulation: false,
          })
          .catch((e) => console.error("[SecurityGateway] Async alert error:", e.message));
      }

      // If this was an authenticated user, apply account-level temporary restriction
      if (authenticatedUser) {
        const blockResult = await securityGatewayService.blockUserAccount({
          userId: authenticatedUser._id,
          userEmail: authenticatedUser.email,
          reason: evaluation.reason || "Automated anomalous traffic detected",
          source: BLOCK_SOURCES.AI_SECURITY_GATEWAY,
          req,
        });

        return res.status(403).json({
          success: false,
          code: "USER_TEMPORARILY_BLOCKED",
          message: "Your account has been temporarily restricted due to suspicious activity.",
          blockedUntil: blockResult?.user?.blockedUntil || new Date(Date.now() + 15 * 60 * 1000),
          remainingSeconds: blockResult?.user?.remainingSeconds || 900,
        });
      }

      return res.status(403).json({
        success: false,
        message: "Automated anomalous traffic detected and blocked by the security gateway.",
        reason: evaluation.reason,
        requestId,
        blockedClientId: evaluation.clientIdentifier,
      });
    }
  } catch (evalErr) {
    console.warn("[SecurityGateway] Non-fatal evaluation error:", evalErr.message);
  }

  // 5. Post-response telemetry tracker
  res.on("finish", () => {
    try {
      const effectiveClientId = evaluation.clientIdentifier;
      securityGatewayService.recordRequest({
        clientIdentifier: effectiveClientId,
        ipAddress,
        userAgent,
        path,
        method: httpMethod,
        payloadBytes,
        status: res.statusCode,
        account,
        requestId,
        decision: evaluation.decision || "NORMAL",
        clientType: CLIENT_TYPES.REAL,
        isSimulation: false,
      });
    } catch (_e) {
      // safe fallback
    }
  });

  next();
};

module.exports = securityGatewayMiddleware;
