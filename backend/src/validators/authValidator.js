const { body } = require("express-validator");

const signupValidator = [
  body("fullName")
    .trim()
    .notEmpty()
    .withMessage("Full name is required.")
    .isLength({ min: 3 })
    .withMessage("Full name must be at least 3 characters."),

  body("email")
    .trim()
    .isEmail()
    .withMessage("Please enter a valid email.")
    .normalizeEmail(),

  body("phone")
    .optional({ checkFalsy: true })
    .trim(),

  body("password")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters."),
];

const loginValidator = [
  body("email")
    .trim()
    .isEmail()
    .withMessage("Please enter a valid email.")
    .normalizeEmail(),

  body("password")
    .notEmpty()
    .withMessage("Password is required."),
];

const forgotPasswordValidator = [
  body("email")
    .trim()
    .isEmail()
    .withMessage("Please enter a valid email.")
    .normalizeEmail(),
];

const verifyOTPValidator = [
  body("email")
    .trim()
    .isEmail()
    .withMessage("Valid email is required.")
    .normalizeEmail(),

  body("otp")
    .trim()
    .isLength({ min: 6, max: 6 })
    .withMessage("OTP must be 6 digits."),
];

const resetPasswordValidator = [
  body("email")
    .trim()
    .isEmail()
    .withMessage("Valid email is required.")
    .normalizeEmail(),

  body("password")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters."),
];

const googleLoginValidator = [
  body("idToken")
    .notEmpty()
    .withMessage("Google ID Token is required."),
];

module.exports = {
  signupValidator,
  loginValidator,
  forgotPasswordValidator,
  verifyOTPValidator,
  resetPasswordValidator,
  googleLoginValidator,
};