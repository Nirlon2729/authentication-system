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
const {
  isProtectedSuperAdmin,
  isSuperAdmin,
  PROTECTED_SUPER_ADMIN_EMAIL,
} = require("../utils/authHelpers");

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
    // client_id -> { expiry, reason, score, ipAddress, userAgent, createdAt, endpoint }
    this.blockedClients = new Map();
    // account/email -> Array of timestamps of failed logins
    this.failedLoginsByAccount = new Map();
    // account/email -> Array of timestamps of failed OTPs
    this.failedOTPsByAccount = new Map();
    // email -> lastAlertTimestamp
    this.alertCooldowns = new Map();
    // userId -> { blockedUntil, reason }
    this.blockedUserAccounts = new Map();

    // In-memory live event buffer for real-time dashboard stream
    this.liveEvents = [];

    // Real production traffic telemetry counters
    this.totalRequests = 0;
    this.allowedRequests = 0;
    this.suspiciousRequests = 0;
    this.blockedRequests = 0;
    this.criticalEvents = 0;

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
  }) {
    const now = Date.now();
    this.lastEventTime = new Date();

    this.totalRequests++;
    if (decision === GATEWAY_DECISIONS.BLOCKED || status === 403) {
      this.blockedRequests++;
    } else if (decision === GATEWAY_DECISIONS.SUSPICIOUS || decision === GATEWAY_DECISIONS.HIGH_RISK) {
      this.suspiciousRequests++;
    } else {
      this.allowedRequests++;
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

    // The protected Super Admin is permanently immune from failed login counters
    if (normalized === PROTECTED_SUPER_ADMIN_EMAIL.toLowerCase().trim()) {
      return 0;
    }

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

    // The protected Super Admin is permanently immune from failed OTP counters
    if (normalized === PROTECTED_SUPER_ADMIN_EMAIL.toLowerCase().trim()) {
      return 0;
    }

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
  // Blocklist Management
  // =========================================================================

  /**
   * Checks if a client is currently blocked.
   */
  isClientBlocked(clientIdentifier) {
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

    const remainingSeconds = Math.max(0, Math.ceil((blockData.expiry - now) / 1000));
    return {
      isBlocked: true,
      reason: blockData.reason,
      riskScore: blockData.score,
      remainingSeconds,
      createdAt: blockData.createdAt,
      clientType: CLIENT_TYPES.REAL,
    };
  }

  /**
   * Helper alias returning a boolean indicating if clientIdentifier is blocked
   */
  isBlocked(clientIdentifier) {
    return this.isClientBlocked(clientIdentifier).isBlocked;
  }

  /**
   * Temporarily blocks a client identifier
   */
  blockClient(
    clientIdentifier,
    reason = "Automated high-risk security anomaly",
    durationSeconds = 300,
    ipAddress = "127.0.0.1",
    userAgent = "",
    endpoint = ""
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
      clientType: CLIENT_TYPES.REAL,
    });

    this.blockedRequests++;
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
   * Gets list of active blocked clients
   */
  getBlockedClientsList() {
    const now = Date.now();
    const list = [];

    for (const [clientId, data] of this.blockedClients.entries()) {
      if (now <= data.expiry) {
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
          clientType: CLIENT_TYPES.REAL,
          isSimulation: false,
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
  async blockUserAccount(arg1, arg2, arg3, arg4) {
    let userId, userEmail, reason, durationMinutes, source, adminUserId, req;
    if (arg1 && typeof arg1 === "object" && !mongoose.Types.ObjectId.isValid(arg1)) {
      ({
        userId,
        userEmail = "",
        reason = "Automated anomalous behavior detected",
        durationMinutes = null,
        source = BLOCK_SOURCES.AI_SECURITY_GATEWAY,
        adminUserId = null,
        req = null,
      } = arg1);
    } else {
      userId = arg1;
      reason = arg2 || "Automated anomalous behavior detected";
      durationMinutes = arg3 || null;
      userEmail = arg4 || "";
      source = BLOCK_SOURCES.AI_SECURITY_GATEWAY;
    }

    if (!userId && !userEmail) {
      return { success: false, blocked: false, reason: "No user identifier provided" };
    }

    // Direct pre-check for protected Super Admin identity
    if (
      isProtectedSuperAdmin(userEmail) ||
      isProtectedSuperAdmin(userId) ||
      userEmail.toLowerCase().trim() === PROTECTED_SUPER_ADMIN_EMAIL.toLowerCase().trim()
    ) {
      return { success: false, blocked: false, reason: "SUPER_ADMIN accounts cannot be locked out." };
    }

    const duration = durationMinutes || Number(process.env.SECURITY_USER_BLOCK_MINUTES) || 15;
    const blockedUntil = new Date(Date.now() + duration * 60 * 1000);

    let user = null;
    if (User) {
      if (userId && mongoose.Types.ObjectId.isValid(userId)) {
        user = await User.findById(userId);
      } else if (userEmail) {
        user = await User.findOne({ email: userEmail.toLowerCase().trim() });
      }
    }

    // Safety Rule 1: Super Admin and protected accounts must NEVER be locked out
    if (user && (isProtectedSuperAdmin(user) || user.role === ROLES.SUPER_ADMIN || isSuperAdmin(user))) {
      console.warn(`[SecurityGateway] Attempted to block Super Admin (${user.email}) - Operation blocked by safety guard.`);

      const ipAddress = req?.ip || req?.socket?.remoteAddress || "127.0.0.1";
      const userAgent = req?.headers?.["user-agent"] || "";
      const requestId = req?.headers?.["x-request-id"] || "";

      await this.logSecurityEvent({
        eventType: "SUPER_ADMIN_BLOCK_EXCLUDED",
        severity: SEVERITY_LEVELS.LOW,
        requestId,
        ipAddress,
        clientIdentifier: this.getClientIdentifier(ipAddress, userAgent),
        userAgent,
        userId: user._id,
        userEmail: user.email,
        actionTaken: GATEWAY_ACTIONS.ALLOWED,
        reason: `Automated or manual block on protected Super Admin account (${user.email}) was safely excluded by system policy.`,
        riskScore: 0,
        metadata: { excludedUser: user.email, excludedRole: user.role },
        isSimulation: false,
      });

      return { success: false, blocked: false, reason: "SUPER_ADMIN accounts cannot be locked out." };
    }

    // Safety Rule 2: Prevent administrators from blocking their own account
    if (adminUserId && user?._id && adminUserId.toString() === user._id.toString()) {
      return { success: false, blocked: false, reason: "Administrators cannot block their own account." };
    }

    const targetIdStr = user?._id ? user._id.toString() : (userId ? userId.toString() : "");
    if (targetIdStr) {
      this.blockedUserAccounts.set(targetIdStr, { blockedUntil, reason });
    }

    if (user) {
      user.isBlocked = true;
      user.blockedUntil = blockedUntil;
      user.blockReason = reason;
      user.blockSource = source;
      user.blockedAt = new Date();
      user.blockedBy = adminUserId || null;

      await user.save();
    }

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
      userId: user?._id || userId,
      userEmail: user?.email || userEmail,
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

    return {
      success: true,
      blocked: true,
      user: {
        id: user?._id || userId,
        email: user?.email || userEmail,
        isBlocked: true,
        blockedUntil,
        blockReason: reason,
        remainingSeconds: duration * 60,
      },
    };
  }

  /**
   * Checks whether a user account is currently blocked in memory
   */
  isAccountBlocked(userId) {
    if (!userId) return false;
    const idStr = userId.toString();
    const entry = this.blockedUserAccounts.get(idStr);
    if (!entry) return false;
    if (entry.blockedUntil && new Date(entry.blockedUntil) <= new Date()) {
      this.blockedUserAccounts.delete(idStr);
      return false;
    }
    return true;
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
   */
  async evaluateRequest({
    ipAddress = "127.0.0.1",
    userAgent = "Unknown",
    path = "/",
    httpMethod = "GET",
    payloadBytes = 0,
    account = "",
    requestId = "",
  }) {
    const clientIdentifier = this.getClientIdentifier(ipAddress, userAgent);

    // Layer 1: Check existing blocklist
    const blockCheck = this.isClientBlocked(clientIdentifier);
    if (blockCheck.isBlocked) {
      return {
        decision: GATEWAY_DECISIONS.BLOCKED,
        severity: SEVERITY_LEVELS.CRITICAL,
        riskScore: blockCheck.riskScore || 95,
        action: GATEWAY_ACTIONS.BLOCKED,
        reason: blockCheck.reason || "Client is temporarily blocked by Security Gateway.",
        clientIdentifier,
        clientType: CLIENT_TYPES.REAL,
        isSimulation: false,
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
      this.criticalEvents++;
      this.blockClient(
        clientIdentifier,
        indicators.join("; ") || "Automated high-risk cyber anomaly",
        300,
        ipAddress,
        userAgent,
        path
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
        path
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
      clientType: CLIENT_TYPES.REAL,
      isSimulation: false,
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
      metadata,
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
   * Returns in-memory live events stream
   */
  getLiveEvents(limit = 50) {
    return this.liveEvents.slice(0, limit);
  }

  /**
   * Sends account security alert email with cooldown throttling.
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
  }) {
    if (!userEmail) return { sent: false, suppressed: true };

    const normalized = userEmail.toLowerCase().trim();

    // Safety rule: never email test accounts or invalid domains
    if (
      normalized.endsWith(".invalid") ||
      normalized.includes("example.invalid") ||
      normalized.startsWith("security-test")
    ) {
      return { sent: false, suppressed: true, reason: "Test email address suppressed" };
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
   * Returns current gateway system status
   */
  getGatewayStatus() {
    return {
      status: "ONLINE",
      aiEngine: this.isGatewayAvailable ? "READY (FastAPI + IsolationForest)" : "READY (In-Process ML Fallback)",
      redis: this.isRedisConnected ? "CONNECTED" : "FALLBACK_MODE",
      backend: "ONLINE",
      protection: "ACTIVE",
      totalRequests: this.totalRequests,
      allowedRequests: this.allowedRequests,
      suspiciousRequests: this.suspiciousRequests,
      blockedRequests: this.blockedRequests,
      criticalEvents: this.criticalEvents,
      activeBlockedClients: this.getBlockedClientsList().length,
      lastEvent: this.lastEventTime,
    };
  }
}

const securityGatewayService = new SecurityGatewayService();
module.exports = securityGatewayService;
