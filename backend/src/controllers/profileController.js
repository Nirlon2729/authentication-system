const asyncHandler = require("../utils/asyncHandler");
const generateOTP = require("../utils/generateOTP");
const hashOTP = require("../utils/hashOTP");
const compareOTP = require("../utils/compareOTP");
const hashPassword = require("../utils/hashPassword");
const comparePassword = require("../utils/comparePassword");
const sanitizeUser = require("../utils/sanitizeData");
const { generateTokens } = require("../services/tokenService");
const otpTemplate = require("../templates/email/otpTemplate");
const changeEmailOTPTemplate = require("../templates/email/changeEmailOTPTemplate");
const emailChangedOldTemplate = require("../templates/email/emailChangedOldTemplate");
const emailChangedNewTemplate = require("../templates/email/emailChangedNewTemplate");
const passwordChangedTemplate = require("../templates/email/passwordChangedTemplate");
const sendEmail = require("../services/emailService");
const Session = require("../models/Session");
const User = require("../models/User");

const {
  updateProfile,
  changePassword,
} = require("../services/profileService");
const {
  createOTP,
  deleteOTP,
  findOTPByEmailAndType,
  verifyOTP,
  findVerifiedOTPByType,
  findVerifiedOTP,
  incrementAttempts,
} = require("../services/otpService");
const {
  findUserByEmail,
  updateUserEmail,
} = require("../services/authService");
const {
  deleteAccountService,
} = require("../services/accountService");
const {
  findUserSessions,
  revokeSession,
  revokeAllSessions,
} = require("../services/sessionService");

/* ==========================================================================
   1. Get Current Profile
========================================================================== */
const getProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select("-password");
  if (!user) {
    return res.status(404).json({
      success: false,
      message: "User not found.",
    });
  }

  res.status(200).json({
    success: true,
    user: sanitizeUser(user),
  });
});

/* ==========================================================================
   2. Update User Profile
========================================================================== */
const updateUserProfile = asyncHandler(async (req, res) => {
  const { fullName, phone, isVerified } = req.body;

  const updateFields = {};
  if (fullName !== undefined) updateFields.fullName = fullName.trim();
  if (phone !== undefined) updateFields.phone = phone.trim();
  if (typeof isVerified === "boolean") updateFields.isVerified = isVerified;

  const updatedUser = await updateProfile(req.user._id, updateFields);

  res.status(200).json({
    success: true,
    message: "Profile updated successfully.",
    user: sanitizeUser(updatedUser),
  });
});

/* ==========================================================================
   3. Upload Profile Picture
========================================================================== */
const uploadProfilePicture = asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: "Please upload an image.",
    });
  }

  const updatedUser = await updateProfile(req.user._id, {
    profilePicture: req.file.path,
  });

  res.status(200).json({
    success: true,
    message: "Profile picture updated successfully.",
    user: sanitizeUser(updatedUser),
  });
});

/* ==========================================================================
   4. Delete Account
========================================================================== */
const deleteAccount = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  if (!user) {
    return res.status(404).json({
      success: false,
      message: "User not found.",
    });
  }

  // Local account requires password verification
  if (user.provider === "local" && user.hasPassword) {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({
        success: false,
        message: "Password is required to delete account.",
      });
    }

    const isMatch = await comparePassword(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Incorrect password.",
      });
    }
  }

  await deleteAccountService(user);

  res.clearCookie("token");

  res.status(200).json({
    success: true,
    message: "Account deleted successfully.",
  });
});

/* ==========================================================================
   5. Request Password Change OTP
========================================================================== */
const requestChangePasswordOTP = asyncHandler(async (req, res) => {
  const user = req.user;

  if (user.provider !== "local") {
    return res.status(400).json({
      success: false,
      message: "Only local accounts can request password change OTP.",
    });
  }

  await deleteOTP(user.email, "CHANGE_PASSWORD");

  const otp = generateOTP();
  const hashedOTP = await hashOTP(otp);
  const otpExpireMinutes = Number(process.env.OTP_EXPIRE_MINUTES) || 10;

  await createOTP({
    user: user._id,
    email: user.email,
    phone: user.phone || "",
    otp: hashedOTP,
    type: "CHANGE_PASSWORD",
    deliveryMethod: "EMAIL",
    expiresAt: new Date(Date.now() + otpExpireMinutes * 60 * 1000),
  });

  try {
    await sendEmail({
      to: user.email,
      subject: "Change Password OTP Verification",
      html: otpTemplate(user.fullName, otp, otpExpireMinutes),
    });
  } catch (emailError) {
    console.error("❌ Failed to send change password OTP email:", emailError.message);
    return res.status(500).json({
      success: false,
      message: "Failed to deliver verification code email. Please try again later.",
    });
  }

  res.status(200).json({
    success: true,
    message: "OTP sent successfully to your registered email.",
  });
});

/* ==========================================================================
   6. Change User Password
========================================================================== */
const changeUserPassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword, otp } = req.body;
  const user = await User.findById(req.user._id);

  if (!user) {
    return res.status(404).json({
      success: false,
      message: "User not found.",
    });
  }

  if (user.provider !== "local") {
    return res.status(400).json({
      success: false,
      message: "Google accounts cannot change password. Use create password instead.",
    });
  }

  if (!otp) {
    return res.status(400).json({
      success: false,
      message: "Verification code (OTP) is required.",
    });
  }

  if (!newPassword || newPassword.length < 8) {
    return res.status(400).json({
      success: false,
      message: "New password must be at least 8 characters.",
    });
  }

  // Verify OTP first
  const otpRecord = await findVerifiedOTPByType(user.email, "CHANGE_PASSWORD");

  if (!otpRecord) {
    return res.status(400).json({
      success: false,
      message: "Please verify your OTP code first.",
    });
  }

  const isMatch = await comparePassword(currentPassword, user.password);
  if (!isMatch) {
    return res.status(401).json({
      success: false,
      message: "Current password is incorrect.",
    });
  }

  const hashedPassword = await hashPassword(newPassword);
  await changePassword(user._id, hashedPassword);

  // Invalidate previous sessions
  await revokeAllSessions(user._id);

  // Clean up OTP record
  await deleteOTP(user.email, "CHANGE_PASSWORD");

  // Send confirmation email
  try {
    await sendEmail({
      to: user.email,
      subject: "Security Alert: Password Changed",
      html: passwordChangedTemplate(user.fullName),
    });
  } catch (emailError) {
    console.error("❌ Failed to send password changed email:", emailError.message);
  }

  res.status(200).json({
    success: true,
    message: "Password changed successfully.",
  });
});

/* ==========================================================================
   7. Request Create Password OTP (For Google Users)
========================================================================== */
const requestCreatePasswordOTP = asyncHandler(async (req, res) => {
  const user = req.user;

  if (user.provider !== "google") {
    return res.status(400).json({
      success: false,
      message: "Only Google accounts can create a password.",
    });
  }

  if (user.hasPassword) {
    return res.status(400).json({
      success: false,
      message: "Password already exists for this account.",
    });
  }

  await deleteOTP(user.email, "CREATE_PASSWORD");

  const otp = generateOTP();
  const hashedOTP = await hashOTP(otp);
  const otpExpireMinutes = Number(process.env.OTP_EXPIRE_MINUTES) || 10;

  await createOTP({
    user: user._id,
    email: user.email,
    phone: user.phone || "",
    otp: hashedOTP,
    type: "CREATE_PASSWORD",
    deliveryMethod: "EMAIL",
    expiresAt: new Date(Date.now() + otpExpireMinutes * 60 * 1000),
  });

  try {
    await sendEmail({
      to: user.email,
      subject: "Create Password OTP",
      html: otpTemplate(user.fullName, otp, otpExpireMinutes),
    });
  } catch (emailError) {
    console.error("❌ Failed to send create password OTP email:", emailError.message);
    return res.status(500).json({
      success: false,
      message: "Failed to deliver verification code email. Please try again later.",
    });
  }

  res.status(200).json({
    success: true,
    message: "OTP sent successfully.",
  });
});

/* ==========================================================================
   8. Create Password (For Google Users)
========================================================================== */
const createPassword = asyncHandler(async (req, res) => {
  const { password } = req.body;
  const user = await User.findById(req.user._id);

  if (!user) {
    return res.status(404).json({
      success: false,
      message: "User not found.",
    });
  }

  if (user.provider !== "google") {
    return res.status(400).json({
      success: false,
      message: "Only Google accounts can create a password.",
    });
  }

  if (user.hasPassword) {
    return res.status(400).json({
      success: false,
      message: "Password already exists.",
    });
  }

  if (!password || password.length < 8) {
    return res.status(400).json({
      success: false,
      message: "Password must be at least 8 characters.",
    });
  }

  const otpRecord =
    (await findVerifiedOTPByType(user.email, "CREATE_PASSWORD")) ||
    (await findVerifiedOTP(user.email));

  if (!otpRecord) {
    return res.status(400).json({
      success: false,
      message: "OTP verification required.",
    });
  }

  const hashedPassword = await hashPassword(password);

  user.password = hashedPassword;
  user.hasPassword = true;
  await user.save();

  await deleteOTP(user.email, "CREATE_PASSWORD");

  res.status(200).json({
    success: true,
    message: "Password created successfully.",
    user: sanitizeUser(user),
  });
});

/* ==========================================================================
   9. Sessions Management
========================================================================== */
const getUserSessions = asyncHandler(async (req, res) => {
  const sessions = await findUserSessions(req.user._id || req.user.id);

  res.status(200).json({
    success: true,
    sessions,
  });
});

const logoutSession = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;

  const session = await Session.findOne({
    _id: sessionId,
    user: req.user._id || req.user.id,
    isRevoked: false,
  });

  if (!session) {
    return res.status(404).json({
      success: false,
      message: "Session not found or already logged out.",
    });
  }

  await revokeSession(sessionId);

  res.status(200).json({
    success: true,
    message: "Session logged out successfully.",
  });
});

/* ==========================================================================
   10. Change Email
========================================================================== */
const requestEmailChangeOTP = asyncHandler(async (req, res) => {
  const { newEmail, password } = req.body;
  const user = await User.findById(req.user._id);

  if (!newEmail) {
    return res.status(400).json({
      success: false,
      message: "New email is required.",
    });
  }

  const normalizedNewEmail = newEmail.toLowerCase().trim();

  if (normalizedNewEmail === user.email.toLowerCase()) {
    return res.status(400).json({
      success: false,
      message: "New email cannot be the same as current email.",
    });
  }

  if (user.provider === "local" && user.hasPassword) {
    if (!password) {
      return res.status(400).json({
        success: false,
        message: "Current password is required to change email.",
      });
    }

    const isMatch = await comparePassword(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Incorrect password.",
      });
    }
  }

  // Check if target email already taken
  const existingUser = await findUserByEmail(normalizedNewEmail);
  if (existingUser) {
    return res.status(409).json({
      success: false,
      message: "Email is already registered by another account.",
    });
  }

  // Delete previous OTP for newEmail
  await deleteOTP(normalizedNewEmail, "CHANGE_EMAIL");

  const otp = generateOTP();
  const hashedOTP = await hashOTP(otp);
  const otpExpireMinutes = Number(process.env.OTP_EXPIRE_MINUTES) || 10;

  await createOTP({
    user: user._id,
    email: normalizedNewEmail,
    otp: hashedOTP,
    type: "CHANGE_EMAIL",
    deliveryMethod: "EMAIL",
    expiresAt: new Date(Date.now() + otpExpireMinutes * 60 * 1000),
  });

  try {
    await sendEmail({
      to: normalizedNewEmail,
      subject: "Verify Your New Email",
      html: changeEmailOTPTemplate(user.fullName, otp),
    });
  } catch (emailError) {
    console.error("❌ Failed to send email change OTP:", emailError.message);
    return res.status(500).json({
      success: false,
      message: "Failed to deliver verification code email. Please try again later.",
    });
  }

  res.status(200).json({
    success: true,
    message: "OTP sent successfully to your new email.",
  });
});

const verifyEmailChangeOTP = asyncHandler(async (req, res) => {
  const { newEmail, otp } = req.body;

  if (!newEmail || !otp) {
    return res.status(400).json({
      success: false,
      message: "New email and OTP code are required.",
    });
  }

  const normalizedNewEmail = newEmail.toLowerCase().trim();
  const otpRecord = await findOTPByEmailAndType(normalizedNewEmail, "CHANGE_EMAIL");

  if (!otpRecord) {
    return res.status(404).json({
      success: false,
      message: "OTP not found or expired.",
    });
  }

  if (otpRecord.expiresAt < new Date()) {
    await deleteOTP(normalizedNewEmail, "CHANGE_EMAIL");
    return res.status(400).json({
      success: false,
      message: "OTP has expired.",
    });
  }

  const maxAttempts = Number(process.env.MAX_OTP_ATTEMPTS) || 5;
  if (otpRecord.attempts >= maxAttempts) {
    return res.status(400).json({
      success: false,
      message: "Maximum OTP attempts exceeded.",
    });
  }

  const matched = await compareOTP(otp, otpRecord.otp);
  if (!matched) {
    await incrementAttempts(otpRecord._id);
    return res.status(400).json({
      success: false,
      message: "Invalid OTP.",
    });
  }

  // Mark OTP verified
  await verifyOTP(otpRecord._id);

  const oldEmail = req.user.email;

  // Update user's email in DB
  const user = await updateUserEmail(req.user._id, normalizedNewEmail);

  // Generate new Access and Refresh tokens
  const { accessToken, refreshToken } = generateTokens(user, false);

  // Notify old email
  try {
    await sendEmail({
      to: oldEmail,
      subject: "Your Email Address Was Changed",
      html: emailChangedOldTemplate(user.fullName, user.email),
    });
  } catch (err) {
    console.error("Old email notice failed:", err.message);
  }

  // Notify new email
  try {
    await sendEmail({
      to: user.email,
      subject: "Email Changed Successfully",
      html: emailChangedNewTemplate(user.fullName),
    });
  } catch (err) {
    console.error("New email notice failed:", err.message);
  }

  // Clean up used OTP
  await deleteOTP(normalizedNewEmail, "CHANGE_EMAIL");

  res.status(200).json({
    success: true,
    message: "Email changed successfully.",
    token: accessToken,
    user: sanitizeUser(user),
  });
});

/* ==========================================================================
   11. Verify Email (Profile In-App Verification)
========================================================================== */
const requestVerifyEmailOTP = asyncHandler(async (req, res) => {
  const user = req.user;
  const otp = generateOTP();
  const hashedOTP = await hashOTP(otp);
  const otpExpireMinutes = Number(process.env.OTP_EXPIRE_MINUTES) || 10;

  await deleteOTP(user.email, "VERIFY_EMAIL");
  await createOTP({
    user: user._id,
    email: user.email,
    otp: hashedOTP,
    type: "VERIFY_EMAIL",
    expiresAt: new Date(Date.now() + otpExpireMinutes * 60 * 1000),
  });

  try {
    await sendEmail({
      to: user.email,
      subject: "🔐 Your Email Verification OTP Code",
      html: otpTemplate(user.fullName, otp, otpExpireMinutes),
    });
  } catch (emailError) {
    console.error("Failed to send verify email OTP:", emailError.message);
    return res.status(500).json({
      success: false,
      message: "Failed to deliver verification code email. Please try again later.",
    });
  }

  res.status(200).json({
    success: true,
    message: `Verification OTP code sent to ${user.email}`,
  });
});

const confirmVerifyEmailOTP = asyncHandler(async (req, res) => {
  const { otp } = req.body;
  const user = await User.findById(req.user._id);

  if (!user) {
    return res.status(404).json({
      success: false,
      message: "User not found.",
    });
  }

  const otpRecord = await findOTPByEmailAndType(user.email, "VERIFY_EMAIL");
  if (!otpRecord) {
    return res.status(404).json({
      success: false,
      message: "OTP not found or expired. Please request a new code.",
    });
  }

  const matched = await compareOTP(otp, otpRecord.otp);
  if (!matched) {
    await incrementAttempts(otpRecord._id);
    return res.status(400).json({
      success: false,
      message: "Incorrect OTP code. Please check your email inbox.",
    });
  }

  await deleteOTP(user.email, "VERIFY_EMAIL");

  user.isVerified = true;
  await user.save();

  res.status(200).json({
    success: true,
    message: "Email address verified successfully!",
    user: sanitizeUser(user),
  });
});

module.exports = {
  getProfile,
  updateUserProfile,
  uploadProfilePicture,
  deleteAccount,
  changeUserPassword,
  requestChangePasswordOTP,
  requestCreatePasswordOTP,
  createPassword,
  getUserSessions,
  logoutSession,
  requestEmailChangeOTP,
  verifyEmailChangeOTP,
  requestVerifyEmailOTP,
  confirmVerifyEmailOTP,
};