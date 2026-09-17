const express = require("express");
const router = express.Router();
const validationMiddleware = require("../middleware/validationMiddleware");
const { sendOTP, verifyOTP } = require("../controllers/otpController");
const {
  sendOTPValidator,
  verifyOTPValidator,
} = require("../validators/otpValidator");

const { otpLimiter } = require("../middleware/rateLimiter");

router.post("/send", otpLimiter, sendOTPValidator, validationMiddleware, sendOTP);
router.post("/verify", otpLimiter, verifyOTPValidator, validationMiddleware, verifyOTP);

module.exports = router;
