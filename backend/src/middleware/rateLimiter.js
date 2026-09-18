const rateLimit = require("express-rate-limit");

/**
 * Standard handler to format rate limit responses with 429 status code and Retry-After header.
 * Namespaces keys for simulation traffic so real client IP rate buckets are completely protected.
 */
const createRateLimiter = ({
  windowMs,
  max,
  message = "Too many requests. Please try again later.",
  statusCode = 429,
  skipSimulation = false,
}) => {
  return rateLimit({
    windowMs,
    max,
    statusCode,
    validate: { keyGeneratorIpFallback: false },
    standardHeaders: true, // Return standard RateLimit headers
    legacyHeaders: false, // Disable X-RateLimit headers
    skip: (req) => {
      if (req.method === "OPTIONS") return true;
      if (skipSimulation && req.isSimulation) return true;
      return false;
    },
    keyGenerator: (req) => {
      // Use synthetic test client ID for simulations to guarantee real IP is never affected
      if (req.simulation && req.simulation.testClientId) {
        return `sim:${req.simulation.testClientId}`;
      }
      return (
        req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
        req.socket?.remoteAddress ||
        req.ip ||
        "127.0.0.1"
      );
    },
    handler: (req, res, _next, options) => {
      const retryAfter = Math.ceil(options.windowMs / 1000);
      res.setHeader("Retry-After", String(retryAfter));
      res.status(options.statusCode).json({
        success: false,
        statusCode: 429,
        error: "TOO_MANY_REQUESTS",
        message: typeof options.message === "string" ? options.message : options.message.message,
        retryAfterSeconds: retryAfter,
      });
    },
    message: { success: false, message },
  });
};

// 1. General API Limiter (Skips simulation so synthetic tests do not consume real IP budget)
const generalLimiter = createRateLimiter({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_MAX_REQUESTS) || 300,
  message: "Too many requests from this client. Please slow down.",
  skipSimulation: true,
});

// 2. Login Limiter (Brute-force protection)
const loginLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_LOGIN_MAX) || 20,
  message: "Too many login attempts. Please try again in 15 minutes.",
  skipSimulation: true,
});

// 3. Signup Limiter
const signupLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_SIGNUP_MAX) || 15,
  message: "Too many account registrations requested. Please try again later.",
  skipSimulation: true,
});

// 4. Forgot Password Limiter
const forgotPasswordLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_FORGOT_MAX) || 10,
  message: "Too many password reset requests. Please try again in 15 minutes.",
  skipSimulation: true,
});

// 5. OTP Limiter (Generation & Verification)
const otpLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_OTP_MAX) || 15,
  message: "Too many OTP requests or submissions. Please wait a few minutes.",
  skipSimulation: true,
});

// 6. Password Reset Submission Limiter
const passwordResetLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_RESET_MAX) || 10,
  message: "Too many password reset submissions. Please try again later.",
  skipSimulation: true,
});

// 7. Admin API Limiter
const adminLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_ADMIN_MAX) || 300,
  message: "Admin API rate limit exceeded.",
  skipSimulation: true,
});

// 8. Security Test Lab Limiter (Dedicated limiter for synthetic traffic evaluation)
const securityTestLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: Number(process.env.RATE_LIMIT_TEST_MAX) || 300,
  message: "Security Test Lab rate limit exceeded. Test throttled for stability.",
  skipSimulation: false,
});

module.exports = generalLimiter;
module.exports.limiter = generalLimiter;
module.exports.generalLimiter = generalLimiter;
module.exports.authLimiter = loginLimiter;
module.exports.loginLimiter = loginLimiter;
module.exports.signupLimiter = signupLimiter;
module.exports.forgotPasswordLimiter = forgotPasswordLimiter;
module.exports.otpLimiter = otpLimiter;
module.exports.passwordResetLimiter = passwordResetLimiter;
module.exports.adminLimiter = adminLimiter;
module.exports.securityTestLimiter = securityTestLimiter;