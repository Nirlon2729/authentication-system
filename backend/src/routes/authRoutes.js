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

// ==============================
// Public Routes
// ==============================

router.post(
  "/signup/request",
  signupValidator,
  validationMiddleware,
  signupRequest
);
router.post(
  "/signup/complete",
  signupComplete
);

// Signup
router.post(
  "/signup",
  signupValidator,
  validationMiddleware,
  signup
);

// Login
router.post(
  "/login",
  loginValidator,
  validationMiddleware,
  login
);

// google login
router.post(
  "/google",
  googleLoginValidator,
  validationMiddleware,
  googleLogin
);

// Forgot Password
router.post(
  "/forgot-password",
  forgotPasswordValidator,
  validationMiddleware,
  forgotPassword
);

// Verify OTP
router.post(
  "/verify-otp",
  verifyOTPValidator,
  validationMiddleware,
  verifyOTPController
);
// reset password
router.post(
  "/reset-password",
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