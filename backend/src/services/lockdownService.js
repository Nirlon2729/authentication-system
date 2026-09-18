const mongoose = require("mongoose");
const SystemLockdown = require("../models/SystemLockdown");
const {
  SECURITY_EVENT_TYPES,
  SEVERITY_LEVELS,
  GATEWAY_ACTIONS,
  LOCKDOWN_MODES,
  ROLES,
} = require("../constants/securityEvents");
const securityGatewayService = require("./securityGatewayService");

class LockdownService {
  constructor() {
    this.state = {
      enabled: false,
      mode: LOCKDOWN_MODES.ONLINE,
      reason: "",
      changedBy: null,
      changedByEmail: "",
      changedAt: new Date(),
      expiresAt: null,
    };
    this.isInitialized = false;
  }

  /**
   * Initializes lockdown state from database on boot
   */
  async initialize() {
    if (this.isInitialized) return;
    try {
      if (mongoose.connection.readyState === 1) {
        const record = await SystemLockdown.findOne({ key: "GLOBAL_LOCKDOWN" });
        if (record) {
          this.state = {
            enabled: record.enabled,
            mode: record.mode,
            reason: record.reason || "",
            changedBy: record.changedBy || null,
            changedByEmail: record.changedByEmail || "",
            changedAt: record.changedAt || new Date(),
            expiresAt: record.expiresAt || null,
          };
        }
      }
      this.isInitialized = true;
    } catch (err) {
      console.warn("[LockdownService] Database sync warning (using defaults):", err.message);
    }
  }

  /**
   * Returns whether global website lockdown is currently active
   */
  isLockdownActive() {
    if (!this.state.enabled || this.state.mode !== LOCKDOWN_MODES.LOCKDOWN) {
      return false;
    }

    // Check expiration if configured
    if (this.state.expiresAt && new Date() > new Date(this.state.expiresAt)) {
      this.state.enabled = false;
      this.state.mode = LOCKDOWN_MODES.ONLINE;
      this.state.reason = "Lockdown period expired automatically.";
      return false;
    }

    return true;
  }

  /**
   * Returns current authoritative lockdown status
   */
  getLockdownStatus() {
    return {
      enabled: this.isLockdownActive(),
      mode: this.isLockdownActive() ? LOCKDOWN_MODES.LOCKDOWN : LOCKDOWN_MODES.ONLINE,
      reason: this.state.reason,
      changedBy: this.state.changedBy,
      changedByEmail: this.state.changedByEmail,
      changedAt: this.state.changedAt,
      expiresAt: this.state.expiresAt,
    };
  }

  /**
   * Enables Global Website Lockdown. Requires SUPER_ADMIN authorization.
   */
  async enableLockdown({ reason = "Emergency security maintenance", adminUser, expiresAt = null, req = null }) {
    if (!adminUser || adminUser.role !== ROLES.SUPER_ADMIN) {
      const err = new Error("Unauthorized: Only SUPER_ADMIN can activate global website lockdown.");
      err.statusCode = 403;
      throw err;
    }

    const previousState = { ...this.state };

    this.state = {
      enabled: true,
      mode: LOCKDOWN_MODES.LOCKDOWN,
      reason: reason.trim() || "Emergency security maintenance",
      changedBy: adminUser._id || adminUser.id,
      changedByEmail: adminUser.email || "super_admin",
      changedAt: new Date(),
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    };

    // Persist to MongoDB if connected
    if (mongoose.connection.readyState === 1) {
      try {
        await SystemLockdown.findOneAndUpdate(
          { key: "GLOBAL_LOCKDOWN" },
          {
            $set: {
              enabled: this.state.enabled,
              mode: this.state.mode,
              reason: this.state.reason,
              changedBy: this.state.changedBy,
              changedByEmail: this.state.changedByEmail,
              changedAt: this.state.changedAt,
              expiresAt: this.state.expiresAt,
            },
          },
          { upsert: true, returnDocument: "after" }
        );
      } catch (dbErr) {
        console.error("[LockdownService] Failed to persist lockdown state to MongoDB:", dbErr.message);
      }
    }

    // Record SecurityEvent audit log
    const ipAddress = req?.ip || req?.socket?.remoteAddress || "127.0.0.1";
    const userAgent = req?.headers?.["user-agent"] || "SuperAdminConsole";
    const requestId = req?.headers?.["x-request-id"] || "";

    await securityGatewayService.logSecurityEvent({
      eventType: SECURITY_EVENT_TYPES.WEBSITE_LOCKDOWN_ENABLED,
      severity: SEVERITY_LEVELS.CRITICAL,
      requestId,
      ipAddress,
      userAgent,
      endpoint: req?.originalUrl || "/api/security/super-admin/website/lockdown",
      httpMethod: "POST",
      httpStatus: 200,
      userId: adminUser._id || adminUser.id,
      userEmail: adminUser.email,
      actionTaken: GATEWAY_ACTIONS.BLOCKED,
      reason: `Global website lockdown activated by Super Admin: ${this.state.reason}`,
      riskScore: 100,
      metadata: {
        previousMode: previousState.mode,
        newMode: LOCKDOWN_MODES.LOCKDOWN,
        reason: this.state.reason,
        expiresAt: this.state.expiresAt,
      },
      isSimulation: false,
    });

    console.warn(`🚨 [LOCKDOWN] Global Website Lockdown ACTIVATED by Super Admin ${adminUser.email}. Reason: ${this.state.reason}`);
    return this.getLockdownStatus();
  }

  /**
   * Restores normal website operation. Requires SUPER_ADMIN authorization.
   */
  async disableLockdown({ adminUser, req = null }) {
    if (!adminUser || adminUser.role !== ROLES.SUPER_ADMIN) {
      const err = new Error("Unauthorized: Only SUPER_ADMIN can restore website operations.");
      err.statusCode = 403;
      throw err;
    }

    const previousState = { ...this.state };

    this.state = {
      enabled: false,
      mode: LOCKDOWN_MODES.ONLINE,
      reason: "",
      changedBy: adminUser._id || adminUser.id,
      changedByEmail: adminUser.email || "super_admin",
      changedAt: new Date(),
      expiresAt: null,
    };

    // Persist to MongoDB if connected
    if (mongoose.connection.readyState === 1) {
      try {
        await SystemLockdown.findOneAndUpdate(
          { key: "GLOBAL_LOCKDOWN" },
          {
            $set: {
              enabled: false,
              mode: LOCKDOWN_MODES.ONLINE,
              reason: "",
              changedBy: this.state.changedBy,
              changedByEmail: this.state.changedByEmail,
              changedAt: this.state.changedAt,
              expiresAt: null,
            },
          },
          { upsert: true, returnDocument: "after" }
        );
      } catch (dbErr) {
        console.error("[LockdownService] Failed to persist restored state to MongoDB:", dbErr.message);
      }
    }

    // Record SecurityEvent audit log
    const ipAddress = req?.ip || req?.socket?.remoteAddress || "127.0.0.1";
    const userAgent = req?.headers?.["user-agent"] || "SuperAdminConsole";
    const requestId = req?.headers?.["x-request-id"] || "";

    await securityGatewayService.logSecurityEvent({
      eventType: SECURITY_EVENT_TYPES.WEBSITE_LOCKDOWN_DISABLED,
      severity: SEVERITY_LEVELS.HIGH,
      requestId,
      ipAddress,
      userAgent,
      endpoint: req?.originalUrl || "/api/security/super-admin/website/restore",
      httpMethod: "POST",
      httpStatus: 200,
      userId: adminUser._id || adminUser.id,
      userEmail: adminUser.email,
      actionTaken: GATEWAY_ACTIONS.ALLOWED,
      reason: "Global website lockdown cleared by Super Admin. Normal operations restored.",
      riskScore: 0,
      metadata: {
        previousMode: previousState.mode,
        newMode: LOCKDOWN_MODES.ONLINE,
      },
      isSimulation: false,
    });

    console.log(`✅ [LOCKDOWN] Global Website Lockdown DEACTIVATED by Super Admin ${adminUser.email}. Website restored.`);
    return this.getLockdownStatus();
  }
}

const lockdownService = new LockdownService();
module.exports = lockdownService;
