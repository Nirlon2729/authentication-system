const { body } = require("express-validator");

const updateProfileValidator = [
  body("fullName")
    .optional()
    .trim()
    .isLength({ min: 3, max: 100 })
    .withMessage("Full name must be between 3 and 100 characters."),

  body("phone")
    .optional({ checkFalsy: true })
    .trim(),
];

const changePasswordValidator = [
  body("currentPassword")
    .notEmpty()
    .withMessage("Current password is required."),

  body("newPassword")
    .isLength({ min: 8 })
    .withMessage("New password must be at least 8 characters long."),

  body("otp")
    .trim()
    .isLength({ min: 6, max: 6 })
    .withMessage("OTP must be exactly 6 digits."),
];

const createPasswordValidator = [
  body("password")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters long."),
];

const changeEmailValidator = [
  body("newEmail")
    .trim()
    .isEmail()
    .withMessage("Please enter a valid new email.")
    .normalizeEmail(),

  body("password")
    .optional()
    .notEmpty()
    .withMessage("Current password is required."),
];

module.exports = {
  updateProfileValidator,
  changePasswordValidator,
  createPasswordValidator,
  changeEmailValidator,
};
