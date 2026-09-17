const rateLimit = require("express-rate-limit");

const limiter = rateLimit({
  windowMs:
    Number(process.env.RATE_LIMIT_WINDOW_MS) ||
    15 * 60 * 1000,

  max:
    Number(process.env.RATE_LIMIT_MAX_REQUESTS) || 200,

  standardHeaders: true,
  legacyHeaders: false,

  message: {
    success: false,
    message: "Too many requests. Please try again later.",
  },
});

// Dedicated limiter for login & signup to prevent rapid brute-forcing
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30, // 30 requests per 15 minutes per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many authentication attempts. Please try again in 15 minutes.",
  },
});

// Dedicated limiter for OTP generation & verification
const otpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 15, // 15 requests per 10 minutes per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many OTP requests. Please try again in a few minutes.",
  },
});

// Dedicated limiter for password reset requests
const passwordResetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10, // 10 password reset requests per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many password reset attempts. Please try again later.",
  },
});

module.exports = limiter;
module.exports.limiter = limiter;
module.exports.authLimiter = authLimiter;
module.exports.otpLimiter = otpLimiter;
module.exports.passwordResetLimiter = passwordResetLimiter;