const { body } = require("express-validator");

const sendOTPValidator = [
  body("email")
    .trim()
    .isEmail()
    .withMessage("Please provide a valid email address.")
    .normalizeEmail(),

  body("type")
    .optional()
    .isIn([
      "EMAIL_VERIFICATION",
      "PASSWORD_RESET",
      "CREATE_PASSWORD",
      "SIGNUP",
      "CHANGE_EMAIL",
      "CHANGE_PASSWORD",
      "CREATE_ADMIN",
      "VERIFY_EMAIL",
    ])
    .withMessage("Invalid OTP type."),
];

const verifyOTPValidator = [
  body("email")
    .trim()
    .isEmail()
    .withMessage("Please provide a valid email address.")
    .normalizeEmail(),

  body("otp")
    .trim()
    .isLength({ min: 6, max: 6 })
    .withMessage("OTP must be exactly 6 digits."),

  body("type")
    .optional()
    .isIn([
      "EMAIL_VERIFICATION",
      "PASSWORD_RESET",
      "CREATE_PASSWORD",
      "SIGNUP",
      "CHANGE_EMAIL",
      "CHANGE_PASSWORD",
      "CREATE_ADMIN",
      "VERIFY_EMAIL",
    ])
    .withMessage("Invalid OTP type."),
];

module.exports = {
  sendOTPValidator,
  verifyOTPValidator,
};
