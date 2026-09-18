const asyncHandler = require("../utils/asyncHandler");
const securityGatewayService = require("../services/securityGatewayService");
const securityMonitoringService = require("../services/securityMonitoringService");
const lockdownService = require("../services/lockdownService");
const {
  SECURITY_EVENT_TYPES,
  SEVERITY_LEVELS,
  GATEWAY_DECISIONS,
  GATEWAY_ACTIONS,
  CLIENT_TYPES,
  BLOCK_SOURCES,
} = require("../constants/securityEvents");

/**
 * 1. Live Overview Statistics (with trafficType filter)
 */
const getStats = asyncHandler(async (req, res) => {
  const trafficType = req.query.trafficType || "ALL";
  const stats = await securityMonitoringService.getLiveStats(trafficType);
  res.status(200).json({
    success: true,
    stats,
  });
});

/**
 * 2. Filtered & Paginated Security Events
 */
const getEvents = asyncHandler(async (req, res) => {
  const result = await securityMonitoringService.getEvents(req.query);
  res.status(200).json({
    success: true,
    ...result,
  });
});

/**
 * 3. Real-Time Live Security Feed (In-memory buffer)
 */
const getLiveFeed = asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit, 10) || 50;
  const trafficType = req.query.trafficType || "ALL";
  const liveEvents = securityGatewayService.getLiveEvents(limit, trafficType);
  const status = securityGatewayService.getGatewayStatus(trafficType);

  res.status(200).json({
    success: true,
    liveEvents,
    status,
  });
});

/**
 * 4. Traffic Graph Time-Series Timeline
 */
const getTrafficTimeline = asyncHandler(async (req, res) => {
  const range = req.query.range || "15m";
  const trafficType = req.query.trafficType || "ALL";
  const data = await securityMonitoringService.getTrafficTimeline(range, trafficType);
  res.status(200).json({
    success: true,
    ...data,
  });
});

/**
 * 5. Threat & Anomaly Analytics (Risk score and attack distributions)
 */
const getThreatAnalytics = asyncHandler(async (req, res) => {
  const trafficType = req.query.trafficType || "ALL";
  const analytics = await securityMonitoringService.getThreatAnalytics(trafficType);
  res.status(200).json({
    success: true,
    analytics,
  });
});

/**
 * 6. Active Blocked Clients List
 */
const getBlockedClients = asyncHandler(async (req, res) => {
  const trafficType = req.query.trafficType || "ALL";
  const blockedClients = securityGatewayService.getBlockedClientsList(trafficType);
  res.status(200).json({
    success: true,
    total: blockedClients.length,
    blockedClients,
  });
});

/**
 * 7. Manual Unblock Client
 */
const unblockClient = asyncHandler(async (req, res) => {
  const { clientId } = req.params;
  if (!clientId) {
    return res.status(400).json({
      success: false,
      message: "Client ID is required.",
    });
  }

  const unblocked = securityGatewayService.unblockClient(clientId);
  if (unblocked) {
    // Log manual unblock event
    await securityGatewayService.logSecurityEvent({
      eventType: SECURITY_EVENT_TYPES.ADMIN_UNBLOCK_CLIENT,
      severity: SEVERITY_LEVELS.LOW,
      clientIdentifier: clientId,
      endpoint: `/api/admin/security/unblock/${clientId}`,
      httpMethod: "POST",
      userId: req.user?._id,
      userEmail: req.user?.email || "admin",
      actionTaken: GATEWAY_ACTIONS.ALLOWED,
      reason: `Client ${clientId} manually unblocked by admin.`,
      riskScore: 0,
      gatewayDecision: GATEWAY_DECISIONS.NORMAL,
      clientType: CLIENT_TYPES.REAL,
    });

    return res.status(200).json({
      success: true,
      message: `Client ${clientId} unblocked successfully.`,
    });
  }

  res.status(404).json({
    success: false,
    message: `Client ${clientId} was not found in the active blocklist.`,
  });
});

/**
 * 8. Export Security Events to CSV
 */
const exportCSV = asyncHandler(async (req, res) => {
  const csvContent = await securityMonitoringService.exportEventsCSV(req.query);

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename=security_events_${new Date().toISOString().slice(0, 10)}.csv`
  );
  res.status(200).send(csvContent);
});

/**
 * 9. Gateway Health & System Status
 */
const getSystemStatus = asyncHandler(async (req, res) => {
  const trafficType = req.query.trafficType || "ALL";
  const status = securityGatewayService.getGatewayStatus(trafficType);
  res.status(200).json({
    success: true,
    status,
  });
});

/**
 * 10. Start Controlled Simulation
 * Generates an isolated synthetic test context with a cryptographically signed authorization token.
 */
const startSimulation = asyncHandler(async (req, res) => {
  const { testType = "NORMAL_TRAFFIC", requestCount = 25, intervalMs = 250 } = req.body;
  const adminId = req.user?._id?.toString() || "admin";

  const simContext = securityGatewayService.createSimulation({
    adminId,
    testType,
    requestCount,
    intervalMs,
  });

  res.status(200).json({
    success: true,
    message: `Controlled ${testType} test initialized.`,
    simulation: {
      simulationId: simContext.simulationId,
      testAccountId: simContext.testAccountId,
      testEmail: simContext.testEmail,
      testClientId: simContext.testClientId,
      syntheticIp: simContext.syntheticIp,
      syntheticUserAgent: simContext.syntheticUserAgent,
      simulationToken: simContext.simulationToken,
      testType: simContext.testType,
      requestCount: simContext.requestCount,
      intervalMs: simContext.intervalMs,
      expiresAt: simContext.expiresAt,
    },
  });
});

/**
 * 11. Dedicated Internal Security Test Endpoint
 * Handles individual synthetic requests within a verified simulation context.
 */
const handleTestTraffic = asyncHandler(async (req, res) => {
  const {
    testType = "NORMAL_TRAFFIC",
    payloadData = "",
    index = 1,
    simulatedBurst = false,
  } = req.body || {};

  const isSimulation = req.isSimulation;
  const sim = req.simulation;

  // If this test simulates failed logins or invalid OTPs on the test account, track it safely
  if (isSimulation && sim) {
    if (testType === "FAILED_LOGIN_SIM") {
      securityGatewayService.recordFailedLogin(sim.testEmail);
    } else if (testType === "INVALID_OTP_SIM") {
      securityGatewayService.recordFailedOTP(sim.testEmail);
    }
  }

  const evalResult = req.securityEvaluation || {
    decision: GATEWAY_DECISIONS.NORMAL,
    severity: SEVERITY_LEVELS.LOW,
    riskScore: 0,
    action: GATEWAY_ACTIONS.ALLOWED,
    reason: "Normal baseline test traffic",
  };

  // If gateway blocked the synthetic client, return 403 to simulator with details
  if (
    evalResult.action === GATEWAY_ACTIONS.BLOCKED ||
    evalResult.decision === GATEWAY_DECISIONS.HIGH_RISK ||
    evalResult.decision === GATEWAY_DECISIONS.CRITICAL
  ) {
    return res.status(403).json({
      success: false,
      message: "Automated anomalous traffic detected and blocked by the security gateway.",
      testType,
      index,
      evaluation: evalResult,
      isSimulation,
      blockedClientId: evalResult.clientIdentifier,
    });
  }

  res.status(200).json({
    success: true,
    message: "Security gateway evaluation completed.",
    testType,
    index,
    evaluation: evalResult,
    isSimulation,
  });
});

/**
 * 12. Stop Active Simulation
 */
const stopSimulation = asyncHandler(async (req, res) => {
  const { simulationId } = req.body;
  securityGatewayService.stopSimulation(simulationId);

  res.status(200).json({
    success: true,
    message: "Security simulation stopped and temporary test state cleaned.",
  });
});

/**
 * 13. Super Admin Global Website Lockdown Status
 */
const getWebsiteLockdownStatus = asyncHandler(async (req, res) => {
  const status = lockdownService.getLockdownStatus();
  res.status(200).json({
    success: true,
    status,
  });
});

/**
 * 14. Super Admin Enable Global Website Lockdown
 */
const enableWebsiteLockdown = asyncHandler(async (req, res) => {
  const { reason, expiresAt } = req.body;
  const status = await lockdownService.enableLockdown({
    reason: reason || "Emergency security maintenance",
    adminUser: req.user,
    expiresAt,
    req,
  });
  res.status(200).json({
    success: true,
    message: "Global website lockdown activated successfully.",
    status,
  });
});

/**
 * 15. Super Admin Restore Website Operation
 */
const restoreWebsite = asyncHandler(async (req, res) => {
  const status = await lockdownService.disableLockdown({
    adminUser: req.user,
    req,
  });
  res.status(200).json({
    success: true,
    message: "Global website lockdown deactivated. Normal operations restored.",
    status,
  });
});

/**
 * 16. Get Active Blocked Users List (with lazy unblock check)
 */
const getBlockedUsers = asyncHandler(async (req, res) => {
  const blockedUsers = await securityGatewayService.getBlockedUsersList();
  res.status(200).json({
    success: true,
    blockedUsers,
    count: blockedUsers.length,
  });
});

/**
 * 17. Manual Unblock User Account
 */
const unblockUser = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const result = await securityGatewayService.unblockUserAccount({
    userId,
    unblockedBy: req.user,
    req,
  });

  if (!result.success) {
    return res.status(400).json(result);
  }

  res.status(200).json(result);
});

/**
 * 18. Manual Block User Account
 */
const blockUser = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { reason, durationMinutes } = req.body;

  const result = await securityGatewayService.blockUserAccount({
    userId,
    reason: reason || "Manually restricted by administrator",
    durationMinutes: durationMinutes ? parseInt(durationMinutes, 10) : 15,
    source: BLOCK_SOURCES.ADMIN_MANUAL,
    adminUserId: req.user._id,
    req,
  });

  if (!result.success) {
    return res.status(400).json(result);
  }

  res.status(200).json(result);
});

module.exports = {
  getStats,
  getEvents,
  getLiveFeed,
  getTrafficTimeline,
  getThreatAnalytics,
  getBlockedClients,
  unblockClient,
  exportCSV,
  getSystemStatus,
  startSimulation,
  runSimulation: startSimulation, // alias for backwards compatibility
  handleTestTraffic,
  stopSimulation,
  getWebsiteLockdownStatus,
  enableWebsiteLockdown,
  restoreWebsite,
  getBlockedUsers,
  unblockUser,
  blockUser,
};
