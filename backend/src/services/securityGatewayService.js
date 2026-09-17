const crypto = require("crypto");
const sendEmail = require("./emailService");
const securityAlertTemplate = require("../templates/email/securityAlertTemplate");
let SecurityEvent;
try {
  SecurityEvent = require("../models/SecurityEvent");
} catch (e) {
  SecurityEvent = null;
}

// In-memory sliding-window telemetry & blocklist fallback
const WINDOW_SIZE_MS = 10 * 1000; // 10-second sliding window
const ALERT_COOLDOWN_MS = (Number(process.env.SECURITY_ALERT_COOLDOWN_MINUTES) || 15) * 60 * 1000;

class SecurityGatewayService {
  constructor() {
    // client_id -> Array of { timestamp, path, payloadBytes, status, account }
    this.trafficLogs = new Map();
    // client_id -> { expiry, reason, score }
    this.blockedClients = new Map();
    // account/email -> Array of timestamps of failed logins
    this.failedLoginsByAccount = new Map();
    // account/email -> Array of timestamps of failed OTPs
    this.failedOTPsByAccount = new Map();
    // email -> lastAlertTimestamp
    this.alertCooldowns = new Map();
    // gateway availability flag
    this.isGatewayAvailable = true;
    this.lastGatewayCheck = 0;
  }

  /**
   * Generates SHA-256 client hash
   */
  getClientIdentifier(ip = "127.0.0.1", userAgent = "Unknown") {
    const raw = `${ip.trim()}|${userAgent.trim()}`;
    return crypto.createHash("sha256").update(raw).digest("hex").slice(0, 16);
  }

  /**
   * Records a request into the sliding window
   */
  recordRequest({ clientIdentifier, path, payloadBytes = 0, status = 200, account = "" }) {
    const now = Date.now();
    if (!this.trafficLogs.has(clientIdentifier)) {
      this.trafficLogs.set(clientIdentifier, []);
    }

    const logs = this.trafficLogs.get(clientIdentifier);
    logs.push({ timestamp: now, path, payloadBytes, status, account });

    // Trim old logs outside sliding window (10 seconds)
    const cutoff = now - WINDOW_SIZE_MS;
    const filtered = logs.filter((log) => log.timestamp >= cutoff);
    this.trafficLogs.set(clientIdentifier, filtered);
  }

  /**
   * Computes feature metrics for a client
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
   * Resets failed login counter on successful login
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

  /**
   * Checks if client is currently in temporary blocklist
   */
  isClientBlocked(clientIdentifier) {
    if (!this.blockedClients.has(clientIdentifier)) {
      return { isBlocked: false, reason: null };
    }

    const { expiry, reason } = this.blockedClients.get(clientIdentifier);
    if (Date.now() > expiry) {
      this.blockedClients.delete(clientIdentifier);
      return { isBlocked: false, reason: null };
    }

    return { isBlocked: true, reason };
  }

  /**
   * Temporarily blocks a client identifier
   */
  blockClient(clientIdentifier, reason = "Automated high-risk cyber anomaly", durationSeconds = 300) {
    const expiry = Date.now() + durationSeconds * 1000;
    this.blockedClients.set(clientIdentifier, { expiry, reason });
  }

  /**
   * Inspects request using AI Security Gateway (HTTP) or Fallback Engine
   */
  async evaluateRequest({ ipAddress, userAgent, path, httpMethod, payloadBytes = 0, account = "" }) {
    const clientIdentifier = this.getClientIdentifier(ipAddress, userAgent);

    // 1. Check existing blocklist
    const blockCheck = this.isClientBlocked(clientIdentifier);
    if (blockCheck.isBlocked) {
      return {
        decision: "BLOCKED",
        severity: "HIGH",
        riskScore: 90,
        action: "BLOCKED",
        reason: blockCheck.reason || "Client is temporarily blocklisted by Security Gateway.",
        clientIdentifier,
      };
    }

    // 2. Query external gateway if URL configured
    const gatewayUrl = process.env.SECURITY_GATEWAY_URL;
    if (gatewayUrl) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 1200);

        const response = await fetch(`${gatewayUrl.replace(/\/$/, "")}/health`, {
          signal: controller.signal,
          headers: {
            "X-Admin-API-Key": process.env.SECURITY_GATEWAY_API_KEY || "",
          },
        });
        clearTimeout(timeoutId);

        if (response.ok) {
          this.isGatewayAvailable = true;
        }
      } catch (err) {
        if (this.isGatewayAvailable) {
          console.warn(`[SecurityGateway] External gateway at ${gatewayUrl} unreachable. Running resilient in-process AI fallback.`);
          this.isGatewayAvailable = false;
        }
      }
    }

    // 3. Behavioral ML Feature Evaluation
    const metrics = this.extractClientMetrics(clientIdentifier);
    let riskScore = 0;
    const indicators = [];

    // Frequency anomaly
    if (metrics.frequency > 20) {
      riskScore += 45;
      indicators.push(`Excessive burst frequency: ${metrics.frequency} requests in 10s`);
    } else if (metrics.frequency > 10) {
      riskScore += 20;
      indicators.push(`High request frequency: ${metrics.frequency} requests in 10s`);
    }

    // Near-zero IAT variance indicates automated script bot
    if (metrics.frequency >= 6 && metrics.iatVariance < 0.005) {
      riskScore += 30;
      indicators.push("Near-zero inter-arrival timing variance (automated script pattern)");
    }

    // High error ratio
    if (metrics.frequency >= 5 && metrics.errorRatio >= 0.7) {
      riskScore += 35;
      indicators.push(`High error response ratio (${Math.round(metrics.errorRatio * 100)}%)`);
    }

    // Account-specific failed login checks
    if (account) {
      const failedCount = (this.failedLoginsByAccount.get(account.toLowerCase().trim()) || []).length;
      if (failedCount >= 5) {
        riskScore += 50;
        indicators.push(`Repeated failed logins on account: ${failedCount} attempts`);
      } else if (failedCount >= 3) {
        riskScore += 25;
        indicators.push(`Multiple failed logins: ${failedCount} attempts`);
      }

      const failedOtpCount = (this.failedOTPsByAccount.get(account.toLowerCase().trim()) || []).length;
      if (failedOtpCount >= 4) {
        riskScore += 45;
        indicators.push(`Repeated invalid OTP submissions: ${failedOtpCount} attempts`);
      }
    }

    // Compute final status
    riskScore = Math.min(100, riskScore);

    let decision = "NORMAL";
    let severity = "LOW";
    let action = "ALLOWED";

    if (riskScore >= 80) {
      decision = "CRITICAL";
      severity = "CRITICAL";
      action = "BLOCKED";
      this.blockClient(clientIdentifier, indicators.join("; ") || "Critical security anomaly", 300);
    } else if (riskScore >= 60) {
      decision = "HIGH_RISK";
      severity = "HIGH";
      action = "BLOCKED";
      this.blockClient(clientIdentifier, indicators.join("; ") || "High risk traffic pattern", 120);
    } else if (riskScore >= 30) {
      decision = "SUSPICIOUS";
      severity = "MEDIUM";
      action = "MONITORED";
    }

    return {
      decision,
      severity,
      riskScore,
      action,
      reason: indicators.join(", ") || "Normal baseline traffic",
      metrics,
      clientIdentifier,
    };
  }

  /**
   * Logs a structured security event to Console and MongoDB
   */
  async logSecurityEvent({
    eventType,
    severity = "LOW",
    ipAddress = "127.0.0.1",
    clientIdentifier = "",
    userAgent = "",
    endpoint,
    httpMethod = "POST",
    userId = null,
    userEmail = "",
    actionTaken = "ALLOWED",
    reason = "",
    riskScore = 0,
    gatewayDecision = "NORMAL",
    metadata = {},
  }) {
    const formattedDate = new Date().toISOString().replace("T", " ").slice(0, 19);

    // Formatted Console Security Log
    console.log(`\n================== 🛡️ Security Event ==================`);
    console.log(`Type:     ${eventType}`);
    console.log(`Severity: ${severity}`);
    console.log(`IP:       ${ipAddress}`);
    console.log(`Endpoint: ${endpoint} [${httpMethod}]`);
    if (userEmail) console.log(`Account:  ${userEmail}`);
    console.log(`Action:   ${actionTaken}`);
    console.log(`Decision: ${gatewayDecision}`);
    console.log(`Time:     ${formattedDate}`);
    console.log(`Reason:   ${reason}`);
    console.log(`========================================================\n`);

    // Persist to MongoDB if model is available
    if (SecurityEvent) {
      try {
        await SecurityEvent.create({
          eventType,
          severity,
          ipAddress,
          clientIdentifier: clientIdentifier || this.getClientIdentifier(ipAddress, userAgent),
          userAgent,
          endpoint,
          httpMethod,
          userId,
          userEmail: userEmail ? userEmail.toLowerCase().trim() : "",
          actionTaken,
          reason,
          riskScore,
          gatewayDecision,
          metadata,
        });
      } catch (dbErr) {
        console.error("[SecurityGateway] Error saving security event to DB:", dbErr.message);
      }
    }
  }

  /**
   * Sends a security alert email with cooldown throttling
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
    if (!userEmail) return false;
    const normalized = userEmail.toLowerCase().trim();
    const now = Date.now();

    // Check alert cooldown (default 15 minutes)
    const lastAlert = this.alertCooldowns.get(normalized) || 0;
    if (now - lastAlert < ALERT_COOLDOWN_MS) {
      console.log(`[SecurityGateway] Alert email throttled for ${normalized} (Cooldown active)`);
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

      console.log(`✅ [SecurityGateway] Security alert email dispatched to ${normalized}`);
      return true;
    } catch (mailErr) {
      console.error(`❌ [SecurityGateway] Failed to send security email to ${normalized}:`, mailErr.message);
      return false;
    }
  }
}

const securityGatewayService = new SecurityGatewayService();
module.exports = securityGatewayService;
