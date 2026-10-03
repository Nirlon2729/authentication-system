const LoginEvent = require("../models/LoginEvent");
const RecognizedDevice = require("../models/RecognizedDevice");
const User = require("../models/User");
const Session = require("../models/Session");
const SecurityEvent = require("../models/SecurityEvent");
const geoLookup = require("../utils/geoLookup");
const deviceService = require("./deviceService");
const { assessLoginRisk } = require("./riskEngineService");
const sendEmail = require("./emailService");
const suspiciousLoginAlertTemplate = require("../templates/email/suspiciousLoginAlertTemplate");
const securityGatewayService = require("./securityGatewayService");
const { parseClientInfo } = require("../utils/clientInfo");

// Throttling for login alert emails: 5-minute cooldown per user + device
const alertThrottleCache = new Map();
const ALERT_THROTTLE_MS = 5 * 60 * 1000;

class LoginSecurityService {
  /**
   * Evaluates, records, and protects genuine login attempts (local and Google OAuth).
   * Safe, non-blocking: never fails the primary authentication flow.
   */
  async processLoginAttempt({
    req,
    res = null,
    user = null,
    email = "",
    provider = "local",
    isSuccess = true,
    failureReason = "",
    session = null,
  }) {
    const startTime = Date.now();
    const clientInfo = parseClientInfo(req);
    const normalizedEmail = (email || user?.email || "").toLowerCase().trim();
    const deviceId = deviceService.resolveDeviceId(req, res);

    try {
      // 1. Resolve approximate IP geolocation
      const location = await geoLookup.lookupIPLocation(clientInfo.ipAddress);

      // 2. Evaluate Device Recognition
      let isNewDevice = false;
      let isFirstDevice = false;
      let isNewBrowserOrOS = false;

      if (user?._id) {
        const devCheck = await deviceService.checkDeviceRecognition(user._id, deviceId, clientInfo);
        isNewDevice = devCheck.isNewDevice;
        isFirstDevice = devCheck.isFirstDevice || false;
        isNewBrowserOrOS = devCheck.isNewBrowserOrOS;
      }

      // 3. Location and Travel Velocity Analysis
      let isUnfamiliarIP = false;
      let isNewCountry = false;
      let isImpossibleTravel = false;
      let impossibleTravelReason = "";

      if (user?._id || normalizedEmail) {
        // Find user's last successful login event
        const lastLoginEvent = await LoginEvent.findOne({
          $or: [{ userId: user?._id }, { userEmail: normalizedEmail }],
          status: "SUCCESS",
        }).sort({ timestamp: -1 });

        if (lastLoginEvent) {
          // Check IP familiarity
          if (lastLoginEvent.ipAddress !== clientInfo.ipAddress) {
            const hasSeenIP = await LoginEvent.exists({
              $or: [{ userId: user?._id }, { userEmail: normalizedEmail }],
              ipAddress: clientInfo.ipAddress,
              status: "SUCCESS",
            });
            isUnfamiliarIP = !hasSeenIP;
          }

          // Check Country familiarity
          if (
            location.country &&
            location.country !== "Unknown Country" &&
            location.country !== "Local Network"
          ) {
            const hasSeenCountry = await LoginEvent.exists({
              $or: [{ userId: user?._id }, { userEmail: normalizedEmail }],
              "location.country": location.country,
              status: "SUCCESS",
            });
            isNewCountry = !hasSeenCountry;
          }

          // Check impossible travel velocity
          if (lastLoginEvent.location && lastLoginEvent.timestamp) {
            const travelCheck = geoLookup.checkImpossibleTravel(
              lastLoginEvent.location,
              location,
              lastLoginEvent.timestamp,
              new Date()
            );

            if (travelCheck.isImpossibleTravel) {
              isImpossibleTravel = true;
              impossibleTravelReason = travelCheck.reason || "";
            }
          }
        }
      }

      // 4. Failed login correlation (from AI security gateway heuristics)
      const failedLoginsCount = securityGatewayService.getFailedLoginCount
        ? securityGatewayService.getFailedLoginCount(normalizedEmail)
        : 0;

      // 5. Recent password change check (< 1 hour)
      let recentPasswordChange = false;
      if (user?._id) {
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        const recentPassEvent = await SecurityEvent.findOne({
          userId: user._id,
          eventType: "PASSWORD_CHANGED",
          timestamp: { $gte: oneHourAgo },
        });
        if (recentPassEvent) {
          recentPasswordChange = true;
        }
      }

      // 6. Assess Risk using Behavior-Based Engine
      const riskAssessment = assessLoginRisk({
        isNewDevice: isSuccess ? isNewDevice : false,
        isFirstDevice,
        isNewBrowserOrOS,
        isUnfamiliarIP,
        isNewCountry,
        isImpossibleTravel,
        impossibleTravelReason,
        failedLoginsCount: isSuccess ? failedLoginsCount : failedLoginsCount + 1,
        recentPasswordChange,
        isGoogleAuth: provider === "google",
      });

      // 7. Determine eventType
      let eventType = "LOCAL_LOGIN_SUCCESS";
      if (!isSuccess) {
        eventType = "LOGIN_FAILED";
      } else if (provider === "google") {
        eventType = "GOOGLE_LOGIN_SUCCESS";
      } else if (isImpossibleTravel || riskAssessment.riskLevel === "CRITICAL") {
        eventType = "HIGH_RISK_LOGIN";
      } else if (isNewCountry) {
        eventType = "UNUSUAL_LOCATION_DETECTED";
      } else if (isNewDevice) {
        eventType = "NEW_DEVICE_DETECTED";
      }

      // 8. Create LoginEvent record
      const loginEvent = await LoginEvent.create({
        userId: user?._id || null,
        userEmail: normalizedEmail,
        eventType,
        provider,
        timestamp: new Date(),
        ipAddress: clientInfo.ipAddress,
        clientIdentifier: clientInfo.clientIdentifier || "",
        deviceId,
        userAgent: clientInfo.userAgent,
        browser: clientInfo.browser,
        operatingSystem: clientInfo.operatingSystem,
        device: clientInfo.device,
        location: {
          country: location.country,
          region: location.region,
          city: location.city,
          latitude: location.latitude,
          longitude: location.longitude,
          isPrivate: location.isPrivate,
        },
        sessionId: session?._id || null,
        riskScore: riskAssessment.riskScore,
        riskLevel: riskAssessment.riskLevel,
        riskReasons: riskAssessment.riskReasons,
        status: isSuccess ? "SUCCESS" : "FAILED",
        notificationStatus: "NONE",
        userReviewStatus: "PENDING",
        investigationStatus:
          riskAssessment.riskLevel === "HIGH" || riskAssessment.riskLevel === "CRITICAL"
            ? "UNDER_INVESTIGATION"
            : "NORMAL",
        metadata: {
          failureReason: failureReason || undefined,
          isNewDevice,
          isNewCountry,
          isImpossibleTravel,
          latencyMs: Date.now() - startTime,
        },
      });

      // 9. If successful, update recognized devices and session link
      if (isSuccess && user?._id) {
        await deviceService.registerOrUpdateDevice(user._id, {
          deviceId,
          browser: clientInfo.browser,
          operatingSystem: clientInfo.operatingSystem,
          device: clientInfo.device,
          userAgent: clientInfo.userAgent,
          ipAddress: clientInfo.ipAddress,
          location,
        });

        if (session) {
          session.deviceId = deviceId;
          session.location = location.displayLocation || location.city || location.country;
          session.loginEventId = loginEvent._id;
          await session.save().catch(() => {});
        }

        // 10. Security Notification dispatch (Medium, High, Critical, or New Device/Location)
        const shouldNotify =
          riskAssessment.riskLevel === "HIGH" ||
          riskAssessment.riskLevel === "CRITICAL" ||
          (riskAssessment.riskLevel === "MEDIUM" && (isNewDevice || isNewCountry));

        if (shouldNotify && normalizedEmail) {
          await this.dispatchSecurityNotification({
            loginEvent,
            user,
            email: normalizedEmail,
            clientInfo,
            location,
            riskAssessment,
            provider,
            deviceId,
          });
        }
      }

      return {
        loginEvent,
        riskLevel: riskAssessment.riskLevel,
        riskScore: riskAssessment.riskScore,
        riskReasons: riskAssessment.riskReasons,
        recommendedAction: riskAssessment.recommendedAction,
        isNewDevice,
        isNewCountry,
        isImpossibleTravel,
      };
    } catch (err) {
      console.error("[LoginSecurityService] Safe fallback on login processing error:", err.message);
      return {
        loginEvent: null,
        riskLevel: "LOW",
        riskScore: 0,
        riskReasons: ["Fallback baseline"],
        recommendedAction: "ALLOW",
        isNewDevice: false,
        isNewCountry: false,
        isImpossibleTravel: false,
      };
    }
  }

  /**
   * Dispatches email notifications with rate-limiting and duplicate suppression.
   */
  async dispatchSecurityNotification({
    loginEvent,
    user,
    email,
    clientInfo,
    location,
    riskAssessment,
    provider,
    deviceId,
  }) {
    const throttleKey = `${email.toLowerCase()}:${deviceId}:${riskAssessment.riskLevel}`;
    const lastSent = alertThrottleCache.get(throttleKey);

    if (lastSent && Date.now() - lastSent < ALERT_THROTTLE_MS) {
      console.log(`🛡️ [LoginSecurity] Suppressed duplicate login alert for ${email} (throttled).`);
      loginEvent.notificationStatus = "SUPPRESSED";
      await loginEvent.save().catch(() => {});
      return false;
    }

    alertThrottleCache.set(throttleKey, Date.now());

    const frontendBaseUrl =
      process.env.FRONTEND_URL || process.env.CLIENT_URL || "http://localhost:5174";
    const actionUrl = `${frontendBaseUrl.replace(/\/$/, "")}/dashboard/security`;

    try {
      const subject =
        riskAssessment.riskLevel === "CRITICAL"
          ? "🚨 URGENT: Critical Security Alert on Your Account"
          : riskAssessment.riskLevel === "HIGH"
          ? "⚠️ Security Notice: Unusual Sign-In Detected"
          : "🔐 Security Notice: Sign-In From a New Device";

      const html = suspiciousLoginAlertTemplate({
        fullName: user?.fullName || "User",
        email,
        loginTime: loginEvent.timestamp,
        ipAddress: clientInfo.ipAddress,
        browser: clientInfo.browser,
        operatingSystem: clientInfo.operatingSystem,
        device: clientInfo.device,
        location: location.displayLocation || "Unknown Location",
        authMethod: provider === "google" ? "Google OAuth" : "Email & Password",
        riskLevel: riskAssessment.riskLevel,
        riskReasons: riskAssessment.riskReasons,
        actionUrl,
      });

      const sendResult = await sendEmail({
        to: email,
        subject,
        html,
      });

      if (sendResult?.success || sendResult?.mocked) {
        loginEvent.notificationStatus = "SENT";
      } else {
        loginEvent.notificationStatus = "FAILED";
      }
      await loginEvent.save().catch(() => {});
      return true;
    } catch (err) {
      console.error("[LoginSecurity] Error sending alert email:", err.message);
      loginEvent.notificationStatus = "FAILED";
      await loginEvent.save().catch(() => {});
      return false;
    }
  }

  /**
   * Retrieves paginated login history for a specific authenticated user.
   */
  async getUserLoginHistory(userId, { page = 1, limit = 20, eventType = null } = {}) {
    if (!userId) return { events: [], total: 0, pages: 0, currentPage: 1 };

    const query = { userId };
    if (eventType) {
      query.eventType = eventType;
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const [events, total] = await Promise.all([
      LoginEvent.find(query)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limitNum)
        .select("-metadata.latencyMs -__v")
        .lean(),
      LoginEvent.countDocuments(query),
    ]);

    return {
      events,
      total,
      pages: Math.ceil(total / limitNum),
      currentPage: pageNum,
    };
  }

  /**
   * Retrieves suspicious login incidents for authorized administrators.
   */
  async getAdminLoginIncidents({
    page = 1,
    limit = 20,
    severity = null,
    status = null,
    search = "",
  } = {}) {
    const query = {};

    if (severity && ["LOW", "MEDIUM", "HIGH", "CRITICAL"].includes(severity.toUpperCase())) {
      query.riskLevel = severity.toUpperCase();
    } else {
      // Default: incidents with MEDIUM, HIGH, or CRITICAL risk
      query.riskLevel = { $in: ["MEDIUM", "HIGH", "CRITICAL"] };
    }

    if (status) {
      query.investigationStatus = status.toUpperCase();
    }

    if (search && typeof search === "string" && search.trim()) {
      const regex = new RegExp(search.trim(), "i");
      query.$or = [{ userEmail: regex }, { ipAddress: regex }, { browser: regex }];
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const [incidents, total] = await Promise.all([
      LoginEvent.find(query)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limitNum)
        .populate("userId", "fullName email role")
        .lean(),
      LoginEvent.countDocuments(query),
    ]);

    return {
      incidents,
      total,
      pages: Math.ceil(total / limitNum),
      currentPage: pageNum,
    };
  }

  /**
   * Updates an incident status and investigation notes (Admin only).
   */
  async updateIncidentStatus(eventId, { status, notes }) {
    const validStatuses = ["NORMAL", "UNDER_INVESTIGATION", "RESOLVED", "FALSE_POSITIVE"];
    if (!validStatuses.includes(status)) {
      throw new Error(`Invalid status: ${status}. Must be one of ${validStatuses.join(", ")}`);
    }

    const event = await LoginEvent.findById(eventId);
    if (!event) return null;

    event.investigationStatus = status;
    if (notes !== undefined) {
      event.investigationNotes = String(notes || "").trim();
    }

    return await event.save();
  }

  /**
   * User reviews a login event (marks as RECOGNIZED or SUSPICIOUS).
   */
  async userReviewLoginEvent(userId, eventId, reviewStatus) {
    if (!["RECOGNIZED", "SUSPICIOUS"].includes(reviewStatus)) {
      throw new Error("Invalid reviewStatus: must be RECOGNIZED or SUSPICIOUS");
    }

    const event = await LoginEvent.findOne({ _id: eventId, userId });
    if (!event) return null;

    event.userReviewStatus = reviewStatus;
    if (reviewStatus === "SUSPICIOUS") {
      event.investigationStatus = "UNDER_INVESTIGATION";
    } else if (reviewStatus === "RECOGNIZED" && event.investigationStatus === "UNDER_INVESTIGATION") {
      event.investigationStatus = "RESOLVED";
    }

    return await event.save();
  }
}

const loginSecurityService = new LoginSecurityService();
module.exports = loginSecurityService;
