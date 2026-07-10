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

  body("password")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters.")
    .matches(/[A-Z]/)
    .withMessage("Password must contain one uppercase letter.")
    .matches(/[a-z]/)
    .withMessage("Password must contain one lowercase letter.")
    .matches(/[0-9]/)
    .withMessage("Password must contain one number.")
    .matches(/[!@#$%^&*(),.?":{}|<>]/)
    .withMessage("Password must contain one special character."),
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
    .isEmail()
    .withMessage("Valid email is required."),

  body("otp")
    .isLength({ min: 6, max: 6 })
    .withMessage("OTP must be 6 digits."),
];
const resetPasswordValidator = [
  body("email")
    .isEmail()
    .withMessage("Valid email is required."),

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