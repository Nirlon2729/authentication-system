const jwt = require("jsonwebtoken");
const lockdownService = require("../services/lockdownService");
const { ROLES } = require("../constants/securityEvents");
let User;
try {
  User = require("../models/User");
} catch (e) {
  User = null;
}

/**
 * Global Website Lockdown Middleware.
 * Enforces server-side application maintenance state while guaranteeing
 * emergency access for SUPER_ADMIN users and non-auth operations for existing sessions.
 */
const websiteLockdownMiddleware = async (req, res, next) => {
  // If lockdown is not active, proceed normally
  if (!lockdownService.isLockdownActive()) {
    return next();
  }

  const url = req.originalUrl || req.url;
  const method = req.method;

  // 1. Root & Health Check endpoints are always allowed
  if (url === "/" || url === "/api" || url === "/api/") {
    return next();
  }

  // 2. Super Admin Emergency Management endpoints are allowed
  // They are protected by authMiddleware + roleMiddleware("super_admin") downstream
  if (url.startsWith("/api/security/super-admin")) {
    return next();
  }

  // Helper for safe 503 responses
  const sendLockdown503 = (customMessage) => {
    const status = lockdownService.getLockdownStatus();
    return res.status(503).json({
      success: false,
      code: "SERVICE_UNAVAILABLE",
      message:
        customMessage ||
        status.reason ||
        "Website is temporarily unavailable for security maintenance. Please try again later.",
      mode: "LOCKDOWN",
      lockdownActive: true,
    });
  };

  // 3. New Authentication Entry Points Evaluation
  // A. Standard Login: Check if incoming email belongs to a SUPER_ADMIN
  if (url.startsWith("/api/auth/login") && method === "POST") {
    const email = req.body?.email ? req.body.email.toLowerCase().trim() : "";
    if (email && User) {
      try {
        const potentialSuperAdmin = await User.findOne({ email }).select("role isBlocked");
        if (
          potentialSuperAdmin &&
          potentialSuperAdmin.role === ROLES.SUPER_ADMIN &&
          !potentialSuperAdmin.isBlocked
        ) {
          // Allow Super Admin to authenticate even during full website lockdown
          return next();
        }
      } catch (err) {
        console.error("[LockdownMiddleware] User lookup error during login:", err.message);
      }
    }
    return sendLockdown503("Website is temporarily unavailable for security maintenance. Please try again later.");
  }

  // B. Google Login: Check if Firebase token belongs to a SUPER_ADMIN
  if (url.startsWith("/api/auth/google") && method === "POST") {
    const idToken = req.body?.idToken || req.body?.token;
    if (idToken && User) {
      try {
        const decoded = jwt.decode(idToken);
        const email = decoded?.email ? decoded.email.toLowerCase().trim() : "";
        if (email) {
          const potentialSuperAdmin = await User.findOne({ email }).select("role isBlocked");
          if (
            potentialSuperAdmin &&
            potentialSuperAdmin.role === ROLES.SUPER_ADMIN &&
            !potentialSuperAdmin.isBlocked
          ) {
            return next();
          }
        }
      } catch (err) {
        console.error("[LockdownMiddleware] Google token decode check error:", err.message);
      }
    }
    return sendLockdown503("Website is temporarily unavailable for security maintenance. Please try again later.");
  }

  // C. Signup, Forgot Password, Reset Password, and OTP are strictly blocked for non-super-admins during lockdown
  if (
    url.startsWith("/api/auth/signup") ||
    url.startsWith("/api/auth/forgot-password") ||
    url.startsWith("/api/auth/reset-password") ||
    url.startsWith("/api/otp")
  ) {
    return sendLockdown503("New registrations and credential modifications are paused during security maintenance.");
  }

  // D. Token Refresh endpoint
  if (url.startsWith("/api/auth/refresh") && method === "POST") {
    let token = null;
    if (req.headers.authorization?.startsWith("Bearer ")) {
      token = req.headers.authorization.split(" ")[1];
    } else if (req.cookies?.refreshToken || req.signedCookies?.refreshToken) {
      token = req.cookies?.refreshToken || req.signedCookies?.refreshToken;
    }

    if (token && process.env.JWT_SECRET) {
      try {
        const decoded = jwt.decode(token);
        if (decoded?.role === ROLES.SUPER_ADMIN) {
          return next();
        }
      } catch (e) {
        // Fall through to 503
      }
    }
    return sendLockdown503();
  }

  // 4. Existing Authenticated Sessions on Protected Routes
  // Allow existing authenticated users to proceed with non-auth operations (Part 7)
  let token = null;
  if (req.headers.authorization?.startsWith("Bearer ")) {
    token = req.headers.authorization.split(" ")[1];
  } else if (req.cookies?.token || req.signedCookies?.token) {
    token = req.cookies?.token || req.signedCookies?.token;
  }

  if (token && process.env.JWT_SECRET) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (decoded && decoded.id) {
        // Super Admin is always allowed
        if (decoded.role === ROLES.SUPER_ADMIN) {
          return next();
        }

        // Existing sessions for non-authentication operations remain usable
        return next();
      }
    } catch (tokenErr) {
      // Invalid/expired token during lockdown cannot proceed
      return sendLockdown503();
    }
  }

  // Any unauthenticated traffic trying to access other API routes during lockdown is rejected
  return sendLockdown503();
};

module.exports = websiteLockdownMiddleware;
