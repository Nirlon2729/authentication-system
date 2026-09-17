const express = require("express");

const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const validationMiddleware = require("../middleware/validationMiddleware");

const {
  signupRequest,
  signupComplete,
  signup,
  login,
  logout,
  forgotPassword,
  verifyOTPController,
  resetPassword,
  googleLogin,
} = require("../controllers/authController");

const {
  signupValidator,
  loginValidator,
  forgotPasswordValidator,
  verifyOTPValidator,
  resetPasswordValidator,
  googleLoginValidator,
} = require("../validators/authValidator");

const {
  authLimiter,
  otpLimiter,
  passwordResetLimiter,
} = require("../middleware/rateLimiter");

// ==============================
// Public Routes
// ==============================

router.post(
  "/signup/request",
  authLimiter,
  signupValidator,
  validationMiddleware,
  signupRequest
);
router.post(
  "/signup/complete",
  authLimiter,
  signupComplete
);

// Signup
router.post(
  "/signup",
  authLimiter,
  signupValidator,
  validationMiddleware,
  signup
);

// Login
router.post(
  "/login",
  authLimiter,
  loginValidator,
  validationMiddleware,
  login
);

// google login
router.post(
  "/google",
  authLimiter,
  googleLoginValidator,
  validationMiddleware,
  googleLogin
);

// Forgot Password
router.post(
  "/forgot-password",
  passwordResetLimiter,
  forgotPasswordValidator,
  validationMiddleware,
  forgotPassword
);

// Verify OTP
router.post(
  "/verify-otp",
  otpLimiter,
  verifyOTPValidator,
  validationMiddleware,
  verifyOTPController
);
// reset password
router.post(
  "/reset-password",
  passwordResetLimiter,
  resetPasswordValidator,
  validationMiddleware,
  resetPassword
);
// ==============================
// Protected Routes
// ==============================

// Logout
router.post(
  "/logout",
  authMiddleware,
  logout
);

module.exports = router;