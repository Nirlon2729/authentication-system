const SecurityEvent = require("../models/SecurityEvent");
const Session = require("../models/Session");
const securityGatewayService = require("./securityGatewayService");
const { CLIENT_TYPES } = require("../constants/securityEvents");

class SecurityMonitoringService {
  /**
   * Aggregates Live Traffic and SOC Dashboard Overview Statistics
   * Supports trafficType filter: 'ALL' | 'REAL' | 'SIMULATION'
   */
  async getLiveStats(trafficType = "ALL") {
    const gatewayStatus = securityGatewayService.getGatewayStatus(trafficType);
    const now = new Date();
    const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);
    const fifteenMinutesAgo = new Date(now.getTime() - 15 * 60 * 1000);

    const baseFilter = {};
    if (trafficType === CLIENT_TYPES.REAL) {
      baseFilter.isSimulation = { $ne: true };
    } else if (trafficType === CLIENT_TYPES.SIMULATION) {
      baseFilter.isSimulation = true;
    }

    let dbStats = {
      totalEvents: 0,
      recentRPM: 0,
      failedLogins: 0,
      failedOTPs: 0,
      activeSessions: 0,
      criticalEvents: 0,
      uniqueClients: 0,
    };

    try {
      // 1. Active sessions count (real sessions only, unless simulation requested)
      const activeSessionsCount = await Session.countDocuments({
        isRevoked: false,
        expiresAt: { $gt: now },
      });
      dbStats.activeSessions = activeSessionsCount;

      // 2. Aggregate DB security event metrics with trafficType filter
      const [
        totalEvents,
        rpmCount,
        failedLoginsCount,
        failedOTPsCount,
        criticalCount,
        uniqueClientsResult,
      ] = await Promise.all([
        SecurityEvent.countDocuments(baseFilter),
        SecurityEvent.countDocuments({ ...baseFilter, timestamp: { $gte: oneMinuteAgo } }),
        SecurityEvent.countDocuments({
          ...baseFilter,
          eventType: { $in: ["FAILED_LOGIN_ATTEMPT", "BRUTE_FORCE_PATTERN"] },
          timestamp: { $gte: fifteenMinutesAgo },
        }),
        SecurityEvent.countDocuments({
          ...baseFilter,
          eventType: "SUSPICIOUS_OTP_ATTEMPT",
          timestamp: { $gte: fifteenMinutesAgo },
        }),
        SecurityEvent.countDocuments({
          ...baseFilter,
          severity: "CRITICAL",
          timestamp: { $gte: fifteenMinutesAgo },
        }),
        SecurityEvent.distinct("clientIdentifier", baseFilter),
      ]);

      dbStats.totalEvents = totalEvents;
      dbStats.recentRPM = rpmCount;
      dbStats.failedLogins = failedLoginsCount;
      dbStats.failedOTPs = failedOTPsCount;
      dbStats.criticalEvents = criticalCount;
      dbStats.uniqueClients = uniqueClientsResult ? uniqueClientsResult.length : 0;
    } catch (err) {
      console.error("[SecurityMonitoring] Stats aggregation fallback:", err.message);
    }

    const blockedClientsList = securityGatewayService.getBlockedClientsList(trafficType);

    return {
      totalRequests: Math.max(gatewayStatus.totalRequests, dbStats.totalEvents),
      requestsPerMinute: dbStats.recentRPM,
      allowedRequests: gatewayStatus.allowedRequests,
      blockedRequests: gatewayStatus.blockedRequests + blockedClientsList.length,
      suspiciousRequests: gatewayStatus.suspiciousRequests,
      criticalEvents: Math.max(gatewayStatus.criticalEvents, dbStats.criticalEvents),
      uniqueClients: Math.max(dbStats.uniqueClients, 1),
      activeBlockedClients: blockedClientsList.length,
      failedLoginAttempts: dbStats.failedLogins,
      failedOTPAttempts: dbStats.failedOTPs,
      activeSessions: dbStats.activeSessions,
      systemStatus: gatewayStatus,
      trafficType,
    };
  }

  /**
   * Generates time-series data for traffic graphs
   * range: '1m', '5m', '15m', '1h', '24h'
   * trafficType: 'ALL' | 'REAL' | 'SIMULATION'
   */
  async getTrafficTimeline(range = "15m", trafficType = "ALL") {
    const now = Date.now();
    let durationMs = 15 * 60 * 1000;
    let bucketsCount = 15;

    switch (range) {
      case "1m":
        durationMs = 60 * 1000;
        bucketsCount = 12; // 5-second intervals
        break;
      case "5m":
        durationMs = 5 * 60 * 1000;
        bucketsCount = 10; // 30-second intervals
        break;
      case "15m":
        durationMs = 15 * 60 * 1000;
        bucketsCount = 15; // 1-minute intervals
        break;
      case "1h":
        durationMs = 60 * 60 * 1000;
        bucketsCount = 12; // 5-minute intervals
        break;
      case "24h":
        durationMs = 24 * 60 * 60 * 1000;
        bucketsCount = 24; // 1-hour intervals
        break;
      default:
        durationMs = 15 * 60 * 1000;
        bucketsCount = 15;
    }

    const intervalMs = Math.floor(durationMs / bucketsCount);
    const startTime = new Date(now - durationMs);

    // Initialize buckets
    const buckets = [];
    for (let i = 0; i < bucketsCount; i++) {
      const bucketStart = new Date(startTime.getTime() + i * intervalMs);
      buckets.push({
        timestamp: bucketStart.toISOString(),
        label: bucketStart.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: range === "1m" || range === "5m" ? "2-digit" : undefined,
        }),
        total: 0,
        allowed: 0,
        suspicious: 0,
        blocked: 0,
        avgRiskScore: 0,
      });
    }

    const query = { timestamp: { $gte: startTime } };
    if (trafficType === CLIENT_TYPES.REAL) {
      query.isSimulation = { $ne: true };
    } else if (trafficType === CLIENT_TYPES.SIMULATION) {
      query.isSimulation = true;
    }

    try {
      const events = await SecurityEvent.find(query).select(
        "timestamp actionTaken gatewayDecision riskScore isSimulation"
      );

      events.forEach((ev) => {
        const evTime = new Date(ev.timestamp).getTime();
        const bucketIndex = Math.min(
          bucketsCount - 1,
          Math.max(0, Math.floor((evTime - startTime.getTime()) / intervalMs))
        );

        const b = buckets[bucketIndex];
        if (b) {
          b.total++;
          if (
            ev.actionTaken === "BLOCKED" ||
            ev.gatewayDecision === "BLOCKED" ||
            ev.gatewayDecision === "CRITICAL"
          ) {
            b.blocked++;
          } else if (ev.gatewayDecision === "SUSPICIOUS" || ev.gatewayDecision === "HIGH_RISK") {
            b.suspicious++;
          } else {
            b.allowed++;
          }
          b.avgRiskScore += ev.riskScore || 0;
        }
      });

      // Normalize average risk scores
      buckets.forEach((b) => {
        if (b.total > 0) {
          b.avgRiskScore = Math.round(b.avgRiskScore / b.total);
        }
      });
    } catch (err) {
      console.error("[SecurityMonitoring] Timeline query error:", err.message);
    }

    return {
      range,
      trafficType,
      timeline: buckets,
    };
  }

  /**
   * Generates Threat & Risk Distribution Analytics with trafficType filter
   */
  async getThreatAnalytics(trafficType = "ALL") {
    const defaultData = {
      riskScoreDistribution: [
        { label: "Low Risk (0-29)", count: 0, color: "#10b981" },
        { label: "Suspicious (30-59)", count: 0, color: "#f59e0b" },
        { label: "High Risk (60-79)", count: 0, color: "#f97316" },
        { label: "Critical (80-100)", count: 0, color: "#ef4444" },
      ],
      attackTypeDistribution: [
        { type: "Failed Login", count: 0 },
        { type: "Brute Force Pattern", count: 0 },
        { type: "Invalid OTP", count: 0 },
        { type: "Password Reset Events", count: 0 },
        { type: "Suspicious Traffic", count: 0 },
        { type: "Rate Limit Events", count: 0 },
        { type: "Blocked Client", count: 0 },
        { type: "Anomalous Bot Traffic", count: 0 },
        { type: "Other Security Events", count: 0 },
      ],
      topTargetedEndpoints: [],
      topClients: [],
    };

    const simFilter = {};
    if (trafficType === CLIENT_TYPES.REAL) {
      simFilter.isSimulation = { $ne: true };
    } else if (trafficType === CLIENT_TYPES.SIMULATION) {
      simFilter.isSimulation = true;
    }

    try {
      // 1. Risk distribution
      const [low, med, high, crit] = await Promise.all([
        SecurityEvent.countDocuments({ ...simFilter, riskScore: { $gte: 0, $lt: 30 } }),
        SecurityEvent.countDocuments({ ...simFilter, riskScore: { $gte: 30, $lt: 60 } }),
        SecurityEvent.countDocuments({ ...simFilter, riskScore: { $gte: 60, $lt: 80 } }),
        SecurityEvent.countDocuments({ ...simFilter, riskScore: { $gte: 80 } }),
      ]);

      defaultData.riskScoreDistribution[0].count = low;
      defaultData.riskScoreDistribution[1].count = med;
      defaultData.riskScoreDistribution[2].count = high;
      defaultData.riskScoreDistribution[3].count = crit;

      // 2. Attack type aggregation
      const attackAgg = await SecurityEvent.aggregate([
        { $match: simFilter },
        { $group: { _id: "$eventType", count: { $sum: 1 } } },
      ]);

      const typeMap = new Map();
      attackAgg.forEach((item) => typeMap.set(item._id, item.count));

      defaultData.attackTypeDistribution = [
        { type: "Failed Login", count: typeMap.get("FAILED_LOGIN_ATTEMPT") || 0 },
        { type: "Brute Force Pattern", count: typeMap.get("BRUTE_FORCE_PATTERN") || 0 },
        { type: "Invalid OTP", count: typeMap.get("SUSPICIOUS_OTP_ATTEMPT") || 0 },
        { type: "Password Reset Events", count: typeMap.get("PASSWORD_RESET_SUCCESS") || 0 },
        { type: "Suspicious Traffic", count: typeMap.get("SUSPICIOUS_TRAFFIC") || 0 },
        { type: "Rate Limit Events", count: typeMap.get("RATE_LIMIT_EXCEEDED") || 0 },
        { type: "Blocked Client", count: typeMap.get("GATEWAY_BLOCKED_REQUEST") || 0 },
        { type: "Anomalous Bot Traffic", count: typeMap.get("ANOMALOUS_BOT_TRAFFIC") || 0 },
        { type: "Other Security Events", count: typeMap.get("SUCCESSFUL_LOGIN") || 0 },
      ];

      // 3. Top targeted endpoints
      const endpointAgg = await SecurityEvent.aggregate([
        {
          $match: {
            ...simFilter,
            $or: [
              { severity: { $in: ["MEDIUM", "HIGH", "CRITICAL"] } },
              { actionTaken: { $in: ["RATE_LIMITED", "BLOCKED"] } },
            ],
          },
        },
        { $group: { _id: "$endpoint", count: { $sum: 1 }, maxRisk: { $max: "$riskScore" } } },
        { $sort: { count: -1 } },
        { $limit: 6 },
      ]);

      defaultData.topTargetedEndpoints = endpointAgg.map((ep) => ({
        endpoint: ep._id,
        count: ep.count,
        maxRisk: ep.maxRisk || 0,
      }));

      // 4. Top abnormal clients
      const clientAgg = await SecurityEvent.aggregate([
        {
          $match: {
            ...simFilter,
            riskScore: { $gte: 30 },
          },
        },
        {
          $group: {
            _id: "$clientIdentifier",
            ip: { $first: "$ipAddress" },
            count: { $sum: 1 },
            avgRisk: { $avg: "$riskScore" },
            lastSeen: { $max: "$timestamp" },
            clientType: { $first: "$clientType" },
            isSimulation: { $first: "$isSimulation" },
          },
        },
        { $sort: { count: -1 } },
        { $limit: 6 },
      ]);

      defaultData.topClients = clientAgg.map((c) => ({
        clientId: c._id || "unknown",
        ipAddress: c.ip || "127.0.0.1",
        eventCount: c.count,
        avgRiskScore: Math.round(c.avgRisk || 0),
        lastSeen: c.lastSeen,
        clientType: c.clientType || (c.isSimulation ? "SIMULATION" : "REAL"),
      }));
    } catch (err) {
      console.error("[SecurityMonitoring] Threat analytics error:", err.message);
    }

    return defaultData;
  }

  /**
   * Queries paginated, filterable security events
   */
  async getEvents({
    page = 1,
    limit = 25,
    severity,
    decision,
    action,
    endpoint,
    eventType,
    search,
    clientId,
    startDate,
    endDate,
    trafficType = "ALL",
  }) {
    const query = {};

    if (trafficType === CLIENT_TYPES.REAL) {
      query.isSimulation = { $ne: true };
    } else if (trafficType === CLIENT_TYPES.SIMULATION) {
      query.isSimulation = true;
    }

    if (severity && severity !== "ALL") {
      query.severity = severity.toUpperCase();
    }
    if (decision && decision !== "ALL") {
      query.gatewayDecision = decision.toUpperCase();
    }
    if (action && action !== "ALL") {
      query.actionTaken = action.toUpperCase();
    }
    if (endpoint) {
      query.endpoint = { $regex: endpoint, $options: "i" };
    }
    if (eventType && eventType !== "ALL") {
      query.eventType = eventType;
    }
    if (clientId) {
      query.clientIdentifier = clientId;
    }
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) query.timestamp.$lte = new Date(endDate);
    }
    if (search) {
      query.$or = [
        { userEmail: { $regex: search, $options: "i" } },
        { ipAddress: { $regex: search, $options: "i" } },
        { clientIdentifier: { $regex: search, $options: "i" } },
        { endpoint: { $regex: search, $options: "i" } },
        { reason: { $regex: search, $options: "i" } },
        { requestId: { $regex: search, $options: "i" } },
        { simulationId: { $regex: search, $options: "i" } },
      ];
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(10, parseInt(limit, 10) || 25));
    const skip = (pageNum - 1) * limitNum;

    try {
      const [events, total] = await Promise.all([
        SecurityEvent.find(query)
          .sort({ timestamp: -1 })
          .skip(skip)
          .limit(limitNum)
          .lean(),
        SecurityEvent.countDocuments(query),
      ]);

      return {
        events,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(total / limitNum) || 1,
        },
      };
    } catch (err) {
      console.error("[SecurityMonitoring] Event fetch error:", err.message);
      return {
        events: [],
        pagination: { total: 0, page: 1, limit: limitNum, totalPages: 1 },
      };
    }
  }

  /**
   * Exports security events to CSV format (Safe fields only, no secrets)
   */
  async exportEventsCSV(filters = {}) {
    const { events } = await this.getEvents({ ...filters, page: 1, limit: 2000 });

    const headers = [
      "Timestamp",
      "Request ID",
      "Traffic Type",
      "Event Type",
      "Severity",
      "Client ID",
      "IP Address",
      "User Agent",
      "Browser",
      "OS",
      "Device",
      "Endpoint",
      "HTTP Method",
      "HTTP Status",
      "Account",
      "Action Taken",
      "Gateway Decision",
      "Risk Score",
      "Reason",
      "Simulation ID",
    ];

    const escapeCSV = (val) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const rows = events.map((ev) => [
      escapeCSV(ev.timestamp ? new Date(ev.timestamp).toISOString() : ""),
      escapeCSV(ev.requestId || ""),
      escapeCSV(ev.isSimulation ? "SIMULATION" : "REAL"),
      escapeCSV(ev.eventType || ""),
      escapeCSV(ev.severity || "LOW"),
      escapeCSV(ev.clientIdentifier || ""),
      escapeCSV(ev.ipAddress || ""),
      escapeCSV(ev.userAgent || ""),
      escapeCSV(ev.browser || ""),
      escapeCSV(ev.operatingSystem || ""),
      escapeCSV(ev.device || ""),
      escapeCSV(ev.endpoint || ""),
      escapeCSV(ev.httpMethod || "POST"),
      escapeCSV(ev.httpStatus || 200),
      escapeCSV(ev.userEmail || ""),
      escapeCSV(ev.actionTaken || "ALLOWED"),
      escapeCSV(ev.gatewayDecision || "NORMAL"),
      escapeCSV(ev.riskScore || 0),
      escapeCSV(ev.reason || ""),
      escapeCSV(ev.simulationId || ""),
    ]);

    return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  }
}

const securityMonitoringService = new SecurityMonitoringService();
module.exports = securityMonitoringService;
