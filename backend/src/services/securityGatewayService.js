const crypto = require("crypto");
const mongoose = require("mongoose");
const sendEmail = require("./emailService");
const securityAlertTemplate = require("../templates/email/securityAlertTemplate");
const {
  SECURITY_EVENT_TYPES,
  SEVERITY_LEVELS,
  GATEWAY_DECISIONS,
  GATEWAY_ACTIONS,
  CLIENT_TYPES,
  ROLES,
  BLOCK_SOURCES,
} = require("../constants/securityEvents");

let SecurityEvent;
try {
  SecurityEvent = require("../models/SecurityEvent");
} catch (e) {
  SecurityEvent = null;
}

let User;
try {
  User = require("../models/User");
} catch (e) {
  User = null;
}

// In-memory sliding-window telemetry & blocklist configuration
const WINDOW_SIZE_MS = 10 * 1000; // 10-second sliding window
const ALERT_COOLDOWN_MS = (Number(process.env.SECURITY_ALERT_COOLDOWN_MINUTES) || 15) * 60 * 1000;
const MAX_IN_MEMORY_LIVE_EVENTS = 100;

class SecurityGatewayService {
  constructor() {
    // client_id -> Array of { timestamp, path, payloadBytes, status, account, method, requestId }
    this.trafficLogs = new Map();
    // client_id -> { expiry, reason, score, ipAddress, userAgent, createdAt, endpoint, clientType, simulationId }
    this.blockedClients = new Map();
    // account/email -> Array of timestamps of failed logins
    this.failedLoginsByAccount = new Map();
    // account/email -> Array of timestamps of failed OTPs
    this.failedOTPsByAccount = new Map();
    // email -> lastAlertTimestamp
    this.alertCooldowns = new Map();

    // In-memory live event buffer for real-time dashboard stream
    this.liveEvents = [];

    // Active security test simulations (simulationId -> context)
    this.activeSimulations = new Map();

    // Real production traffic telemetry counters
    this.totalRequests = 0;
    this.allowedRequests = 0;
    this.suspiciousRequests = 0;
    this.blockedRequests = 0;
    this.criticalEvents = 0;

    // Simulation traffic telemetry counters
    this.simulationCounters = {
      total: 0,
      allowed: 0,
      suspicious: 0,
      blocked: 0,
      critical: 0,
    };

    this.lastEventTime = new Date();

    // Gateway & Redis status
    this.isGatewayAvailable = false;
    this.isRedisConnected = false;
    this.lastGatewayCheck = 0;
  }

  /**
   * Generates privacy-conscious client identifier (IP + User-Agent hashed with SHA-256)
   */
  getClientIdentifier(ip = "127.0.0.1", userAgent = "Unknown") {
    const raw = `${(ip || "127.0.0.1").trim()}|${(userAgent || "Unknown").trim()}`;
    return crypto.createHash("sha256").update(raw).digest("hex").slice(0, 16);
  }

  // =========================================================================
  // Controlled Simulation Lifecycle & Identity Isolation
  // =========================================================================

  /**
   * Initializes a dedicated, isolated test simulation context for an admin.
   */
  createSimulation({ adminId = "admin", testType = "NORMAL_TRAFFIC", requestCount = 25, intervalMs = 250 }) {
    const simulationId = `security-test-${crypto.randomUUID()}`;
    const testAccountId = `sim-account-${crypto.randomBytes(6).toString("hex")}`;
    const testEmail = `security-test-${crypto.randomBytes(4).toString("hex")}@example.invalid`;
    const testClientId = `SIMULATED_ATTACK_${crypto.randomBytes(6).toString("hex").toUpperCase()}`;
    const syntheticIp = `10.255.${Math.floor(Math.random() * 240) + 1}.${Math.floor(Math.random() * 240) + 1}`;
    const syntheticUserAgent = `SentinelAI-Security-Test/2.0 (Synthetic; BotEngine; +https://security.local)`;
    const createdAt = Date.now();
    const expiresAt = createdAt + 15 * 60 * 1000; // 15-minute validity window

    const tokenSecret = process.env.JWT_SECRET || "sentinel-security-test-secret-salt";
    const simulationToken = crypto
      .createHmac("sha256", tokenSecret)
      .update(`${simulationId}:${adminId}:${expiresAt}`)
      .digest("hex");

    const simulationContext = {
      simulationId,
      adminId: String(adminId),
      testAccountId,
      testEmail,
      testClientId,
      syntheticIp,
      syntheticUserAgent,
      testType,
      requestCount: Math.min(100, Math.max(5, parseInt(requestCount, 10) || 25)),
      intervalMs: Math.min(2000, Math.max(50, parseInt(intervalMs, 10) || 250)),
      simulationToken,
      createdAt,
      expiresAt,
      isRunning: true,
      metrics: {
        sent: 0,
        allowed: 0,
        suspicious: 0,
        blocked: 0,
        peakRisk: 0,
      },
    };

    this.activeSimulations.set(simulationId, simulationContext);

    // Record system event for simulation start
    this.logSecurityEvent({
      eventType: SECURITY_EVENT_TYPES.SIMULATION_STARTED,
      severity: SEVERITY_LEVELS.LOW,
      ipAddress: syntheticIp,
      clientIdentifier: testClientId,
      userAgent: syntheticUserAgent,
      endpoint: "/api/security/admin/test/start",
      httpMethod: "POST",
      httpStatus: 200,
      userEmail: testEmail,
      actionTaken: GATEWAY_ACTIONS.MONITORED,
      reason: `Controlled security simulation [${testType}] initiated by admin.`,
      riskScore: 0,
      gatewayDecision: GATEWAY_DECISIONS.NORMAL,
      isSimulation: true,
      simulationId,
      testAccountId,
      clientType: CLIENT_TYPES.SIMULATION,
      metadata: { testType, simulationId, synthetic: true },
    }).catch((e) => console.error("[SecurityGateway] Simulation start log error:", e.message));

    return simulationContext;
  }

  /**
   * Cryptographically validates a simulation authorization token
   */
  verifySimulationToken(simulationId, token) {
    if (!simulationId || !token) return null;
    const sim = this.activeSimulations.get(simulationId);
    if (!sim) return null;

    if (!sim.isRunning || Date.now() > sim.expiresAt) {
      this.activeSimulations.delete(simulationId);
      return null;
    }

    try {
      const tokenSecret = process.env.JWT_SECRET || "sentinel-security-test-secret-salt";
      const expectedToken = crypto
        .createHmac("sha256", tokenSecret)
        .update(`${sim.simulationId}:${sim.adminId}:${sim.expiresAt}`)
        .digest("hex");

      const tokenBuf = Buffer.from(token, "utf8");
      const expectedBuf = Buffer.from(expectedToken, "utf8");

      if (tokenBuf.length === expectedBuf.length && crypto.timingSafeEqual(tokenBuf, expectedBuf)) {
        return sim;
      }
    } catch (_e) {
      return null;
    }

    return null;
  }

  /**
   * Safely stops an active simulation and cleans temporary test state
   */
  stopSimulation(simulationId) {
    if (!simulationId) {
      // Clear all simulations if no ID specified
      for (const [id, sim] of this.activeSimulations.entries()) {
        this.cleanSimulationState(id, sim.testClientId, sim.testEmail);
      }
      this.activeSimulations.clear();
      return true;
    }

    const sim = this.activeSimulations.get(simulationId);
    if (sim) {
      sim.isRunning = false;
      this.cleanSimulationState(simulationId, sim.testClientId, sim.testEmail);
      this.activeSimulations.delete(simulationId);

      this.logSecurityEvent({
        eventType: SECURITY_EVENT_TYPES.SIMULATION_STOPPED,
        severity: SEVERITY_LEVELS.LOW,
        ipAddress: sim.syntheticIp,
        clientIdentifier: sim.testClientId,
        userAgent: sim.syntheticUserAgent,
        endpoint: "/api/security/admin/test/stop",
        httpMethod: "POST",
        httpStatus: 200,
        userEmail: sim.testEmail,
        actionTaken: GATEWAY_ACTIONS.ALLOWED,
        reason: `Controlled security simulation [${sim.testType}] stopped and temporary test state cleaned.`,
        riskScore: 0,
        gatewayDecision: GATEWAY_DECISIONS.NORMAL,
        isSimulation: true,
        simulationId,
        testAccountId: sim.testAccountId,
        clientType: CLIENT_TYPES.SIMULATION,
        metadata: { testType: sim.testType, simulationId, synthetic: true },
      }).catch((e) => console.error("[SecurityGateway] Simulation stop log error:", e.message));

      return true;
    }

    return false;
  }

  /**
   * Prunes in-memory sliding logs, failed login counters, and simulation blocks
   */
  cleanSimulationState(simulationId, testClientId, testEmail) {
    if (testClientId) {
      this.trafficLogs.delete(testClientId);
      this.blockedClients.delete(testClientId);
    }
    if (testEmail) {
      this.failedLoginsByAccount.delete(testEmail.toLowerCase().trim());
      this.failedOTPsByAccount.delete(testEmail.toLowerCase().trim());
    }

    // Clean any other blocked entries tagged with this simulationId
    for (const [clientId, data] of this.blockedClients.entries()) {
      if (data.simulationId === simulationId) {
        this.blockedClients.delete(clientId);
      }
    }
  }

  /**
   * Checks if a simulation is active
   */
  isSimulationActive(simulationId) {
    const sim = this.activeSimulations.get(simulationId);
    return !!(sim && sim.isRunning && Date.now() <= sim.expiresAt);
  }

  // =========================================================================
  // Telemetry Recording & Metrics
  // =========================================================================

  /**
   * Records a request into the sliding window and updates metrics
   */
  recordRequest({
    clientIdentifier,
    ipAddress = "127.0.0.1",
    userAgent = "",
    path = "/",
    method = "GET",
    payloadBytes = 0,
    status = 200,
    account = "",
    requestId = "",
    decision = GATEWAY_DECISIONS.NORMAL,
    clientType = CLIENT_TYPES.REAL,
    isSimulation = false,
    simulationId = null,
  }) {
    const now = Date.now();
    this.lastEventTime = new Date();

    if (isSimulation) {
      this.simulationCounters.total++;
      if (decision === GATEWAY_DECISIONS.BLOCKED || status === 403) {
        this.simulationCounters.blocked++;
      } else if (decision === GATEWAY_DECISIONS.SUSPICIOUS || decision === GATEWAY_DECISIONS.HIGH_RISK) {
        this.simulationCounters.suspicious++;
      } else {
        this.simulationCounters.allowed++;
      }
    } else {
      this.totalRequests++;
      if (decision === GATEWAY_DECISIONS.BLOCKED || status === 403) {
        this.blockedRequests++;
      } else if (decision === GATEWAY_DECISIONS.SUSPICIOUS || decision === GATEWAY_DECISIONS.HIGH_RISK) {
        this.suspiciousRequests++;
      } else {
        this.allowedRequests++;
      }
    }

    if (!this.trafficLogs.has(clientIdentifier)) {
      this.trafficLogs.set(clientIdentifier, []);
    }

    const logs = this.trafficLogs.get(clientIdentifier);
    logs.push({
      timestamp: now,
      path,
      method,
      payloadBytes,
      status,
      account,
      ipAddress,
      userAgent,
      requestId,
      clientType,
      isSimulation,
      simulationId,
    });

    // Trim old logs outside sliding window
    const cutoff = now - WINDOW_SIZE_MS;
    const filtered = logs.filter((log) => log.timestamp >= cutoff);
    this.trafficLogs.set(clientIdentifier, filtered);
  }

  /**
   * Computes feature metrics for a client over the active window
   */
  extractClientMetrics(clientIdentifier) {
    const now = Date.now();
    const cutoff = now - WINDOW_SIZE_MS;
    const rawLogs = this.trafficLogs.get(clientIdentifier) || [];
    const logs = rawLogs.filter((log) => log.timestamp >= cutoff);

    const count = logs.length;
    if (count === 0) {
      return {
        frequency: 0,
        iatVariance: 0,
        errorRatio: 0,
        payloadSizeDelta: 0,
        logCount: 0,
      };
    }

    // 1. Frequency
    const frequency = count;

    // 2. Inter-arrival time variance
    let iatVariance = 0;
    if (count > 1) {
      const timestamps = logs.map((l) => l.timestamp).sort((a, b) => a - b);
      const intervals = [];
      for (let i = 1; i < timestamps.length; i++) {
        intervals.push((timestamps[i] - timestamps[i - 1]) / 1000); // in seconds
      }
      const mean = intervals.reduce((acc, v) => acc + v, 0) / intervals.length;
      iatVariance = intervals.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / intervals.length;
    }

    // 3. Error Ratio (4xx/5xx)
    const errorCount = logs.filter((l) => l.status >= 400).length;
    const errorRatio = count > 0 ? errorCount / count : 0;

    // 4. Payload Size Delta
    const sizes = logs.map((l) => l.payloadBytes || 0);
    const minSize = Math.min(...sizes);
    const maxSize = Math.max(...sizes);
    const payloadSizeDelta = maxSize - minSize;

    return {
      frequency,
      iatVariance: parseFloat(iatVariance.toFixed(4)),
      errorRatio: parseFloat(errorRatio.toFixed(2)),
      payloadSizeDelta,
      logCount: count,
    };
  }

  /**
   * Records a failed login attempt for an account
   */
  recordFailedLogin(email) {
    if (!email) return 1;
    const normalized = email.toLowerCase().trim();
    const now = Date.now();
    const windowMs = 5 * 60 * 1000; // 5-minute window for failed logins

    if (!this.failedLoginsByAccount.has(normalized)) {
      this.failedLoginsByAccount.set(normalized, []);
    }

    const attempts = this.failedLoginsByAccount.get(normalized);
    attempts.push(now);

    const validAttempts = attempts.filter((t) => t >= now - windowMs);
    this.failedLoginsByAccount.set(normalized, validAttempts);

    return validAttempts.length;
  }

  /**
   * Resets failed login counter on successful authentication
   */
  resetFailedLogins(email) {
    if (!email) return;
    this.failedLoginsByAccount.delete(email.toLowerCase().trim());
  }

  /**
   * Records a failed OTP attempt for an account
   */
  recordFailedOTP(email) {
    if (!email) return 1;
    const normalized = email.toLowerCase().trim();
    const now = Date.now();
    const windowMs = 5 * 60 * 1000;

    if (!this.failedOTPsByAccount.has(normalized)) {
      this.failedOTPsByAccount.set(normalized, []);
    }

    const attempts = this.failedOTPsByAccount.get(normalized);
    attempts.push(now);

    const validAttempts = attempts.filter((t) => t >= now - windowMs);
    this.failedOTPsByAccount.set(normalized, validAttempts);

    return validAttempts.length;
  }

  /**
   * Resets failed OTP counter on successful verification
   */
  resetFailedOTPs(email) {
    if (!email) return;
    this.failedOTPsByAccount.delete(email.toLowerCase().trim());
  }

  // =========================================================================
  // Blocklist Management with Total Simulation / Real Client Isolation
  // =========================================================================

  /**
   * Checks if a client is currently blocked.
   * STRICT SAFETY GUARANTEE:
   * If a real client checks the blocklist, a SIMULATION block will NEVER block them.
   */
  isClientBlocked(clientIdentifier, clientType = CLIENT_TYPES.REAL) {
    if (!this.blockedClients.has(clientIdentifier)) {
      return { isBlocked: false, reason: null, remainingSeconds: 0 };
    }

    const blockData = this.blockedClients.get(clientIdentifier);
    const now = Date.now();

    // Prune expired block
    if (now > blockData.expiry) {
      this.blockedClients.delete(clientIdentifier);
      return { isBlocked: false, reason: null, remainingSeconds: 0 };
    }

    // Type namespace check: A real client must NEVER be blocked by a simulation block
    if (clientType === CLIENT_TYPES.REAL && blockData.clientType === CLIENT_TYPES.SIMULATION) {
      return { isBlocked: false, reason: null, remainingSeconds: 0 };
    }

    const remainingSeconds = Math.max(0, Math.ceil((blockData.expiry - now) / 1000));
    return {
      isBlocked: true,
      reason: blockData.reason,
      riskScore: blockData.score,
      remainingSeconds,
      createdAt: blockData.createdAt,
      clientType: blockData.clientType || CLIENT_TYPES.REAL,
      simulationId: blockData.simulationId || null,
    };
  }

  /**
   * Temporarily blocks a client identifier with explicit type namespace
   */
  blockClient(
    clientIdentifier,
    reason = "Automated high-risk security anomaly",
    durationSeconds = 300,
    ipAddress = "127.0.0.1",
    userAgent = "",
    endpoint = "",
    clientType = CLIENT_TYPES.REAL,
    simulationId = null
  ) {
    const now = Date.now();
    const expiry = now + durationSeconds * 1000;

    this.blockedClients.set(clientIdentifier, {
      expiry,
      reason,
      score: 95,
      ipAddress,
      userAgent,
      createdAt: new Date(now),
      endpoint,
      clientType,
      simulationId,
    });

    if (clientType === CLIENT_TYPES.SIMULATION) {
      this.simulationCounters.blocked++;
    } else {
      this.blockedRequests++;
    }
  }

  /**
   * Manually unblocks a client identifier
   */
  unblockClient(clientIdentifier) {
    if (this.blockedClients.has(clientIdentifier)) {
      this.blockedClients.delete(clientIdentifier);
      return true;
    }
    return false;
  }

  /**
   * Gets list of active blocked clients with optional traffic type filter
   */
  getBlockedClientsList(trafficType = "ALL") {
    const now = Date.now();
    const list = [];

    for (const [clientId, data] of this.blockedClients.entries()) {
      if (now <= data.expiry) {
        const isSim = data.clientType === CLIENT_TYPES.SIMULATION;

        if (trafficType === "REAL" && isSim) continue;
        if (trafficType === "SIMULATION" && !isSim) continue;

        list.push({
          clientId,
          reason: data.reason,
          riskScore: data.score || 90,
          ipAddress: data.ipAddress || "127.0.0.1",
          userAgent: data.userAgent || "",
          endpoint: data.endpoint || "",
          createdAt: data.createdAt || new Date(),
          expiry: new Date(data.expiry),
          remainingSeconds: Math.ceil((data.expiry - now) / 1000),
          clientType: data.clientType || CLIENT_TYPES.REAL,
          simulationId: data.simulationId || null,
          isSimulation: isSim,
        });
      } else {
        this.blockedClients.delete(clientId);
      }
    }

    return list;
  }

  // =========================================================================
  // Account-Level Temporary User Blocking (Isolated to req.user._id ONLY)
  // =========================================================================

  /**
   * Evaluates lazy expiration of user account blocking.
   * If blockedUntil has passed, automatically clears blocking flags in memory and database.
   */
  async checkUserBlocked(user) {
    if (!user || !user.isBlocked) {
      return { isBlocked: false };
    }

    const now = new Date();
    if (user.blockedUntil && new Date(user.blockedUntil) <= now) {
      user.isBlocked = false;
      user.blockedUntil = null;
      user.blockReason = "";
      user.blockSource = null;
      if (typeof user.save === "function") {
        user.save().catch((err) => console.error("Lazy user unblock save error:", err.message));
      } else if (User && user._id) {
        User.findByIdAndUpdate(user._id, {
          isBlocked: false,
          blockedUntil: null,
          blockReason: "",
          blockSource: null,
        }).catch((err) => console.error("Lazy user unblock DB error:", err.message));
      }
      return { isBlocked: false };
    }

    const blockedUntilTime = user.blockedUntil ? new Date(user.blockedUntil).getTime() : now.getTime();
    const remainingSeconds = Math.max(0, Math.ceil((blockedUntilTime - now.getTime()) / 1000));

    return {
      isBlocked: true,
      code: "USER_TEMPORARILY_BLOCKED",
      message: "Your account has been temporarily restricted due to suspicious activity.",
      blockedUntil: user.blockedUntil,
      blockReason: user.blockReason || "Suspicious automated activity detected.",
      remainingSeconds,
    };
  }

  /**
   * Temporarily restricts a specific authenticated user account.
   * STRICT SAFETY GUARANTEES:
   * 1. Blocks ONLY the authenticated user's account (user._id).
   * 2. NEVER blocks the whole website.
   * 3. NEVER blocks other legitimate users sharing an IP or subnet.
   * 4. SUPER_ADMIN accounts are explicitly immune from automated blocks.
   */
  async blockUserAccount({
    userId,
    userEmail = "",
    reason = "Automated anomalous behavior detected",
    durationMinutes = null,
    source = BLOCK_SOURCES.AI_SECURITY_GATEWAY,
    adminUserId = null,
    req = null,
  }) {
    if (!userId && !userEmail) {
      return { success: false, reason: "No user identifier provided" };
    }

    const duration = durationMinutes || Number(process.env.SECURITY_USER_BLOCK_MINUTES) || 15;
    const blockedUntil = new Date(Date.now() + duration * 60 * 1000);

    let user = null;
    if (User) {
      if (userId) {
        user = await User.findById(userId);
      } else if (userEmail) {
        user = await User.findOne({ email: userEmail.toLowerCase().trim() });
      }
    }

    if (!user) {
      return { success: false, reason: "User not found" };
    }

    // Safety check: Super Admin must NEVER be locked out by automated heuristics
    if (user.role === ROLES.SUPER_ADMIN) {
      console.warn(`[SecurityGateway] Attempted to block SUPER_ADMIN (${user.email}) - Operation blocked by safety guard.`);
      return { success: false, reason: "SUPER_ADMIN accounts cannot be locked out." };
    }

    user.isBlocked = true;
    user.blockedUntil = blockedUntil;
    user.blockReason = reason;
    user.blockSource = source;
    user.blockedAt = new Date();
    user.blockedBy = adminUserId || null;

    await user.save();

    const ipAddress = req?.ip || req?.socket?.remoteAddress || "127.0.0.1";
    const userAgent = req?.headers?.["user-agent"] || "";
    const requestId = req?.headers?.["x-request-id"] || "";

    await this.logSecurityEvent({
      eventType: SECURITY_EVENT_TYPES.USER_TEMPORARILY_BLOCKED,
      severity: SEVERITY_LEVELS.CRITICAL,
      requestId,
      ipAddress,
      clientIdentifier: this.getClientIdentifier(ipAddress, userAgent),
      userAgent,
      userId: user._id,
      userEmail: user.email,
      actionTaken: GATEWAY_ACTIONS.BLOCKED,
      reason: `Account temporarily blocked: ${reason}`,
      riskScore: 90,
      metadata: {
        blockedUntil,
        blockSource: source,
        durationMinutes: duration,
        blockedBy: adminUserId,
      },
      isSimulation: false,
    });

    console.warn(`⚠️ [SecurityGateway] User account ${user.email} (${user._id}) temporarily blocked for ${duration}m. Reason: ${reason}`);

    return {
      success: true,
      user: {
        id: user._id,
        email: user.email,
        isBlocked: true,
        blockedUntil,
        blockReason: reason,
        remainingSeconds: duration * 60,
      },
    };
  }

  /**
   * Manually unblocks a user account.
   */
  async unblockUserAccount({ userId, unblockedBy = null, req = null }) {
    if (!User) return { success: false, reason: "User model unavailable" };

    const user = await User.findById(userId);
    if (!user) {
      return { success: false, reason: "User not found" };
    }

    user.isBlocked = false;
    user.blockedUntil = null;
    user.blockReason = "";
    user.blockSource = null;
    user.blockedAt = null;
    user.blockedBy = null;

    await user.save();

    const ipAddress = req?.ip || "127.0.0.1";
    const requestId = req?.headers?.["x-request-id"] || "";

    await this.logSecurityEvent({
      eventType: SECURITY_EVENT_TYPES.USER_UNBLOCKED,
      severity: SEVERITY_LEVELS.LOW,
      requestId,
      ipAddress,
      userId: user._id,
      userEmail: user.email,
      actionTaken: GATEWAY_ACTIONS.ALLOWED,
      reason: "User account manually unblocked by administrator",
      riskScore: 0,
      metadata: {
        unblockedBy: unblockedBy?.email || unblockedBy?._id || "Admin",
      },
      isSimulation: false,
    });

    return { success: true, message: `User ${user.email} successfully unblocked.` };
  }

  /**
   * Retrieves list of active blocked user accounts with lazy unblock evaluation
   */
  async getBlockedUsersList() {
    if (!User) return [];

    const now = new Date();
    const users = await User.find({ isBlocked: true })
      .select("fullName email role isBlocked blockedUntil blockReason blockSource blockedAt blockedBy updatedAt")
      .populate("blockedBy", "fullName email")
      .lean();

    const activeBlockedUsers = [];

    for (const u of users) {
      if (u.blockedUntil && new Date(u.blockedUntil) <= now) {
        // Lazily clean in DB
        User.findByIdAndUpdate(u._id, {
          isBlocked: false,
          blockedUntil: null,
          blockReason: "",
          blockSource: null,
        }).catch((err) => console.error("Lazy unblock error in list:", err.message));
      } else {
        const remainingSeconds = u.blockedUntil
          ? Math.max(0, Math.ceil((new Date(u.blockedUntil).getTime() - now.getTime()) / 1000))
          : 0;
        activeBlockedUsers.push({
          id: u._id,
          fullName: u.fullName,
          email: u.email,
          role: u.role,
          reason: u.blockReason || "Suspicious automated activity",
          blockedAt: u.blockedAt || u.updatedAt,
          blockedUntil: u.blockedUntil,
          remainingSeconds,
          remainingMinutes: Math.ceil(remainingSeconds / 60),
          blockSource: u.blockSource || "AI_SECURITY_GATEWAY",
          blockedBy: u.blockedBy ? u.blockedBy.email : "System Automated",
        });
      }
    }

    return activeBlockedUsers;
  }

  /**
   * Checks external Python Smart Gateway health
   */
  async checkExternalGatewayHealth() {
    const gatewayUrl = process.env.SECURITY_GATEWAY_URL;
    if (!gatewayUrl) {
      this.isGatewayAvailable = false;
      return false;
    }

    const now = Date.now();
    if (now - this.lastGatewayCheck < 15000) {
      return this.isGatewayAvailable;
    }

    this.lastGatewayCheck = now;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1500);

      const response = await fetch(`${gatewayUrl.replace(/\/$/, "")}/health`, {
        signal: controller.signal,
        headers: {
          "X-Admin-API-Key": process.env.SECURITY_GATEWAY_API_KEY || "",
        },
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        this.isGatewayAvailable = true;
        this.isRedisConnected = data.redis === "connected";
        return true;
      }
    } catch (_err) {
      this.isGatewayAvailable = false;
      this.isRedisConnected = false;
    }
    return false;
  }

  // =========================================================================
  // Multi-Layer Request Evaluation Engine
  // =========================================================================

  /**
   * Evaluates incoming requests through the behavioral ML threat engine.
   * If isSimulation is true, evaluates under the synthetic identity and blocks
   * ONLY the testClientId, leaving the caller's real client identifier untouched.
   */
  async evaluateRequest({
    ipAddress = "127.0.0.1",
    userAgent = "Unknown",
    path = "/",
    httpMethod = "GET",
    payloadBytes = 0,
    account = "",
    requestId = "",
    clientType = CLIENT_TYPES.REAL,
    isSimulation = false,
    simulationId = null,
    testClientId = null,
  }) {
    // Resolve identifier: simulation uses synthetic testClientId; real uses hashed IP+UA
    const clientIdentifier =
      isSimulation && testClientId ? testClientId : this.getClientIdentifier(ipAddress, userAgent);

    // Layer 1: Check existing blocklist
    const blockCheck = this.isClientBlocked(clientIdentifier, clientType);
    if (blockCheck.isBlocked) {
      return {
        decision: GATEWAY_DECISIONS.BLOCKED,
        severity: SEVERITY_LEVELS.CRITICAL,
        riskScore: blockCheck.riskScore || 95,
        action: GATEWAY_ACTIONS.BLOCKED,
        reason: blockCheck.reason || "Client is temporarily blocked by Security Gateway.",
        clientIdentifier,
        clientType,
        isSimulation,
        simulationId,
        indicators: ["Client ID present on active temporary blocklist"],
      };
    }

    // Layer 2: Check external Smart Gateway availability
    await this.checkExternalGatewayHealth();

    // Layer 3: Multi-Vector Behavioral ML Feature Evaluation
    const metrics = this.extractClientMetrics(clientIdentifier);
    let riskScore = 0;
    const indicators = [];

    // Frequency checks
    if (metrics.frequency > 30) {
      riskScore += 55;
      indicators.push(`High request frequency burst: ${metrics.frequency} req/10s`);
    } else if (metrics.frequency > 15) {
      riskScore += 30;
      indicators.push(`Elevated request frequency: ${metrics.frequency} req/10s`);
    } else if (metrics.frequency > 8) {
      riskScore += 15;
    }

    // Near-zero Inter-arrival time variance indicates automated script bots
    if (metrics.frequency >= 5 && metrics.iatVariance < 0.005) {
      riskScore += 35;
      indicators.push("Near-zero inter-arrival timing variance (automated bot pattern)");
    }

    // High error ratio
    if (metrics.frequency >= 4 && metrics.errorRatio >= 0.6) {
      riskScore += 30;
      indicators.push(`High error response ratio (${Math.round(metrics.errorRatio * 100)}%)`);
    }

    // Unusual payload size
    if (payloadBytes > 5000000) {
      riskScore += 40;
      indicators.push(`Excessive payload size: ${Math.round(payloadBytes / 1024)} KB`);
    }

    // Account-specific brute force check
    if (account) {
      const normalizedAccount = account.toLowerCase().trim();
      const failedCount = (this.failedLoginsByAccount.get(normalizedAccount) || []).length;
      if (failedCount >= 5) {
        riskScore += 50;
        indicators.push(`Repeated authentication failures on account: ${failedCount} attempts`);
      } else if (failedCount >= 3) {
        riskScore += 25;
        indicators.push(`Multiple failed logins: ${failedCount} attempts`);
      }

      const failedOtpCount = (this.failedOTPsByAccount.get(normalizedAccount) || []).length;
      if (failedOtpCount >= 4) {
        riskScore += 45;
        indicators.push(`Repeated invalid OTP submissions: ${failedOtpCount} attempts`);
      }
    }

    riskScore = Math.min(100, riskScore);

    let decision = GATEWAY_DECISIONS.NORMAL;
    let severity = SEVERITY_LEVELS.LOW;
    let action = GATEWAY_ACTIONS.ALLOWED;

    if (riskScore >= 80) {
      decision = GATEWAY_DECISIONS.CRITICAL;
      severity = SEVERITY_LEVELS.CRITICAL;
      action = GATEWAY_ACTIONS.BLOCKED;
      if (isSimulation) {
        this.simulationCounters.critical++;
      } else {
        this.criticalEvents++;
      }
      this.blockClient(
        clientIdentifier,
        indicators.join("; ") || "Automated high-risk cyber anomaly",
        300,
        ipAddress,
        userAgent,
        path,
        clientType,
        simulationId
      );
    } else if (riskScore >= 60) {
      decision = GATEWAY_DECISIONS.HIGH_RISK;
      severity = SEVERITY_LEVELS.HIGH;
      action = GATEWAY_ACTIONS.BLOCKED;
      this.blockClient(
        clientIdentifier,
        indicators.join("; ") || "Suspicious automated traffic burst",
        120,
        ipAddress,
        userAgent,
        path,
        clientType,
        simulationId
      );
    } else if (riskScore >= 30) {
      decision = GATEWAY_DECISIONS.SUSPICIOUS;
      severity = SEVERITY_LEVELS.MEDIUM;
      action = GATEWAY_ACTIONS.MONITORED;
    }

    return {
      decision,
      severity,
      riskScore,
      action,
      reason: indicators.join(", ") || "Normal baseline traffic",
      metrics,
      clientIdentifier,
      clientType,
      isSimulation,
      simulationId,
      indicators,
    };
  }

  // =========================================================================
  // Security Event Logging & SOC Telemetry Stream
  // =========================================================================

  /**
   * Logs a structured security event to DB and live event buffer
   */
  async logSecurityEvent({
    eventType,
    severity = SEVERITY_LEVELS.LOW,
    requestId = "",
    ipAddress = "127.0.0.1",
    clientIdentifier = "",
    userAgent = "",
    browser = "",
    operatingSystem = "",
    device = "",
    endpoint = "/",
    httpMethod = "POST",
    httpStatus = 200,
    userId = null,
    userEmail = "",
    actionTaken = GATEWAY_ACTIONS.ALLOWED,
    reason = "",
    riskScore = 0,
    gatewayDecision = GATEWAY_DECISIONS.NORMAL,
    metadata = {},
    isSimulation = false,
    simulationId = null,
    testAccountId = null,
    clientType = CLIENT_TYPES.REAL,
  }) {
    const client_id = clientIdentifier || this.getClientIdentifier(ipAddress, userAgent);
    const timestamp = new Date();

    const eventObj = {
      timestamp,
      requestId,
      eventType,
      severity,
      ipAddress,
      clientIdentifier: client_id,
      userAgent,
      browser,
      operatingSystem,
      device,
      endpoint,
      httpMethod,
      httpStatus,
      userId,
      userEmail: userEmail ? userEmail.toLowerCase().trim() : "",
      actionTaken,
      reason,
      riskScore,
      gatewayDecision,
      metadata: {
        ...metadata,
        ...(isSimulation ? { synthetic: true, simulationId, testAccountId } : {}),
      },
      isSimulation: !!isSimulation,
      simulationId: simulationId || null,
      testAccountId: testAccountId || null,
      clientType: clientType || (isSimulation ? CLIENT_TYPES.SIMULATION : CLIENT_TYPES.REAL),
    };

    // Maintain in-memory live stream for SOC monitoring
    this.liveEvents.unshift(eventObj);
    if (this.liveEvents.length > MAX_IN_MEMORY_LIVE_EVENTS) {
      this.liveEvents.pop();
    }

    // Persist to MongoDB if connected
    if (SecurityEvent && mongoose.connection.readyState === 1) {
      try {
        await SecurityEvent.create(eventObj);
      } catch (dbErr) {
        console.error("[SecurityGateway] Error persisting security event to MongoDB:", dbErr.message);
      }
    }

    return eventObj;
  }

  /**
   * Returns in-memory live events stream with optional traffic type filter
   */
  getLiveEvents(limit = 50, trafficType = "ALL") {
    let events = this.liveEvents;

    if (trafficType === "REAL") {
      events = events.filter((e) => !e.isSimulation);
    } else if (trafficType === "SIMULATION") {
      events = events.filter((e) => e.isSimulation);
    }

    return events.slice(0, limit);
  }

  /**
   * Sends account security alert email with cooldown throttling.
   * Strictly suppresses email notifications if this is a simulation event or test address.
   */
  async sendSecurityAlertEmailIfNeeded({
    userEmail,
    userName = "User",
    eventTitle,
    description,
    ipAddress = "127.0.0.1",
    device = "Desktop / Chrome",
    actionTaken = "Monitored",
    isBlocked = false,
    recommendation,
    isSimulation = false,
  }) {
    if (!userEmail) return { sent: false, suppressed: true };

    const normalized = userEmail.toLowerCase().trim();

    // Safety rule: never email test accounts or during simulations
    if (
      isSimulation ||
      normalized.endsWith(".invalid") ||
      normalized.includes("example.invalid") ||
      normalized.startsWith("security-test")
    ) {
      return { sent: false, suppressed: true, reason: "Simulation email suppressed" };
    }

    const now = Date.now();
    const lastAlert = this.alertCooldowns.get(normalized) || 0;
    if (now - lastAlert < ALERT_COOLDOWN_MS) {
      return false;
    }

    this.alertCooldowns.set(normalized, now);

    try {
      await sendEmail({
        to: normalized,
        subject: "Security Alert for Your Account",
        html: securityAlertTemplate({
          userEmail: normalized,
          userName,
          eventTitle,
          description,
          timestamp: new Date(),
          ipAddress,
          device,
          actionTaken,
          isBlocked,
          recommendation,
        }),
      });
      return true;
    } catch (mailErr) {
      console.error(`❌ [SecurityGateway] Failed to send alert email to ${normalized}:`, mailErr.message);
      return false;
    }
  }

  /**
   * Returns current gateway system status, support trafficType filter
   */
  getGatewayStatus(trafficType = "ALL") {
    const isSimOnly = trafficType === "SIMULATION";
    const isRealOnly = trafficType === "REAL";

    const totalReq = isSimOnly
      ? this.simulationCounters.total
      : isRealOnly
      ? this.totalRequests
      : this.totalRequests + this.simulationCounters.total;

    const allowedReq = isSimOnly
      ? this.simulationCounters.allowed
      : isRealOnly
      ? this.allowedRequests
      : this.allowedRequests + this.simulationCounters.allowed;

    const suspiciousReq = isSimOnly
      ? this.simulationCounters.suspicious
      : isRealOnly
      ? this.suspiciousRequests
      : this.suspiciousRequests + this.simulationCounters.suspicious;

    const blockedReq = isSimOnly
      ? this.simulationCounters.blocked
      : isRealOnly
      ? this.blockedRequests
      : this.blockedRequests + this.simulationCounters.blocked;

    const criticalEvt = isSimOnly
      ? this.simulationCounters.critical
      : isRealOnly
      ? this.criticalEvents
      : this.criticalEvents + this.simulationCounters.critical;

    return {
      status: "ONLINE",
      aiEngine: this.isGatewayAvailable ? "READY (FastAPI + IsolationForest)" : "READY (In-Process ML Fallback)",
      redis: this.isRedisConnected ? "CONNECTED" : "FALLBACK_MODE",
      backend: "ONLINE",
      protection: "ACTIVE",
      totalRequests: totalReq,
      allowedRequests: allowedReq,
      suspiciousRequests: suspiciousReq,
      blockedRequests: blockedReq,
      criticalEvents: criticalEvt,
      activeBlockedClients: this.getBlockedClientsList(trafficType).length,
      lastEvent: this.lastEventTime,
      activeSimulationsCount: this.activeSimulations.size,
    };
  }
}

const securityGatewayService = new SecurityGatewayService();
module.exports = securityGatewayService;
