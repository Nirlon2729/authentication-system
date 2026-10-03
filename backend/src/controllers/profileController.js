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
const OTP = require("../models/OTP");
const jwt = require("jsonwebtoken");
const securityGatewayService = require("../services/securityGatewayService");
const { parseClientInfo } = require("../utils/clientInfo");
const { isProtectedSuperAdmin } = require("../utils/authHelpers");
const LoginEvent = require("../models/LoginEvent");
const RecognizedDevice = require("../models/RecognizedDevice");
const loginSecurityService = require("../services/loginSecurityService");
const deviceService = require("../services/deviceService");

const maskEmail = (email) => {
  if (!email || !email.includes("@")) return "";
  const [local, domain] = email.split("@");
  if (local.length <= 2) {
    return `${local[0]}***@${domain}`;
  }
  return `${local.slice(0, 2)}${"*".repeat(Math.max(3, local.length - 3))}${local.slice(-1)}@${domain}`;
};

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

  if (isProtectedSuperAdmin(user)) {
    return res.status(403).json({
      success: false,
      message: "The protected root Super Admin account cannot be deleted.",
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
   5. Request Password Change / Setup OTP
========================================================================== */
const requestChangePasswordOTP = asyncHandler(async (req, res) => {
  if (!req.user || !req.user._id) {
    return res.status(401).json({
      success: false,
      message: "Authentication required.",
    });
  }

  const user = await User.findById(req.user._id);

  if (!user) {
    return res.status(404).json({
      success: false,
      message: "User account not found.",
    });
  }

  // Enforce email verification requirement: unverified emails cannot change password
  if (!user.isVerified) {
    return res.status(403).json({
      success: false,
      code: "EMAIL_UNVERIFIED",
      message: "Email verification is required before setting or changing your password. Please verify your email first.",
    });
  }

  // Account block check
  const blockCheck = await securityGatewayService.checkUserBlocked(user);
  if (blockCheck.isBlocked) {
    return res.status(403).json({
      success: false,
      code: "USER_TEMPORARILY_BLOCKED",
      message: "Your account is temporarily restricted. Please try again later.",
      blockedUntil: blockCheck.blockedUntil,
      remainingSeconds: blockCheck.remainingSeconds,
    });
  }

  // Purge any stale OTPs of this type for this account
  await deleteOTP(user.email, "CHANGE_PASSWORD");
  await deleteOTP(user.email, "CREATE_PASSWORD");

  const otp = generateOTP();
  const hashedOTP = await hashOTP(otp);
  const otpExpireMinutes = 5; // Suitable 5-minute security window

  await createOTP({
    user: user._id,
    email: user.email,
    phone: user.phone || "",
    otp: hashedOTP,
    type: "CHANGE_PASSWORD",
    deliveryMethod: "EMAIL",
    expiresAt: new Date(Date.now() + otpExpireMinutes * 60 * 1000),
  });

  const isSettingPassword = !user.hasPassword;
  const subject = isSettingPassword
    ? "🔐 Set Account Password - Verification Code"
    : "🔐 Password Change - Verification Code";

  try {
    await sendEmail({
      to: user.email,
      subject,
      html: otpTemplate(user.fullName, otp, otpExpireMinutes),
    });
  } catch (emailError) {
    console.error("❌ Failed to send change password OTP email:", emailError.message);
    // Delete the OTP so the user is not left in a misleading verification state
    await deleteOTP(user.email, "CHANGE_PASSWORD");
    return res.status(500).json({
      success: false,
      message: "Failed to deliver verification code email. Please check your network or try again later.",
    });
  }

  res.status(200).json({
    success: true,
    message: `Verification code sent to ${maskEmail(user.email)}.`,
    maskedEmail: maskEmail(user.email),
    isSettingPassword,
  });
});

/* ==========================================================================
   5b. Verify Password Change / Setup OTP
========================================================================== */
const verifyChangePasswordOTP = asyncHandler(async (req, res) => {
  if (!req.user || !req.user._id) {
    return res.status(401).json({
      success: false,
      message: "Authentication required.",
    });
  }

  const { otp } = req.body;
  const user = await User.findById(req.user._id);

  if (!user) {
    return res.status(404).json({
      success: false,
      message: "User account not found.",
    });
  }

  if (!otp || typeof otp !== "string" || otp.trim().length !== 6) {
    return res.status(400).json({
      success: false,
      message: "A valid 6-digit verification code is required.",
    });
  }

  const cleanOtp = otp.trim();
  const normalizedEmail = user.email.toLowerCase().trim();

  let otpRecord = await findOTPByEmailAndType(normalizedEmail, "CHANGE_PASSWORD");
  if (!otpRecord) {
    otpRecord = await findOTPByEmailAndType(normalizedEmail, "CREATE_PASSWORD");
  }

  if (!otpRecord) {
    return res.status(400).json({
      success: false,
      message: "Verification code is invalid or has expired. Please request a new code.",
    });
  }

  if (otpRecord.expiresAt < new Date()) {
    await deleteOTP(normalizedEmail, "CHANGE_PASSWORD");
    await deleteOTP(normalizedEmail, "CREATE_PASSWORD");
    return res.status(400).json({
      success: false,
      message: "Verification code has expired. Please request a new code.",
    });
  }

  const maxAttempts = Number(process.env.MAX_OTP_ATTEMPTS) || 5;
  if (otpRecord.attempts >= maxAttempts) {
    await deleteOTP(normalizedEmail, "CHANGE_PASSWORD");
    await deleteOTP(normalizedEmail, "CREATE_PASSWORD");
    return res.status(400).json({
      success: false,
      message: "Maximum verification attempts exceeded. Please request a new code.",
    });
  }

  const matched = await compareOTP(cleanOtp, otpRecord.otp);
  if (!matched) {
    await incrementAttempts(otpRecord._id);
    const failOtpCount = securityGatewayService.recordFailedOTP(normalizedEmail);
    const clientInfo = parseClientInfo(req);

    await securityGatewayService.logSecurityEvent({
      eventType: "SUSPICIOUS_OTP_ATTEMPT",
      severity: failOtpCount >= 3 ? "HIGH" : "MEDIUM",
      ipAddress: clientInfo.ipAddress,
      userAgent: clientInfo.userAgent,
      endpoint: "/api/profile/change-password/verify-otp",
      httpMethod: "POST",
      userId: user._id,
      userEmail: normalizedEmail,
      actionTaken: "MONITORED",
      reason: `Invalid password change OTP submission: attempt #${failOtpCount}`,
      riskScore: Math.min(100, failOtpCount * 25),
      gatewayDecision: failOtpCount >= 3 ? "HIGH_RISK" : "SUSPICIOUS",
    });

    return res.status(400).json({
      success: false,
      message: "Invalid verification code. Please check your email inbox.",
    });
  }

  // Mark OTP record as verified
  await verifyOTP(otpRecord._id);
  securityGatewayService.resetFailedOTPs(normalizedEmail);

  // Issue single-use, short-lived password-change authorization token
  const resetToken = jwt.sign(
    {
      userId: user._id.toString(),
      email: user.email,
      purpose: "PASSWORD_CHANGE",
      otpId: otpRecord._id.toString(),
    },
    process.env.JWT_SECRET,
    { expiresIn: "10m" }
  );

  res.status(200).json({
    success: true,
    message: "Verification code verified successfully.",
    resetToken,
    isSettingPassword: !user.hasPassword,
  });
});

/* ==========================================================================
   6. Change / Set User Password
========================================================================== */
const changeUserPassword = asyncHandler(async (req, res) => {
  if (!req.user || !req.user._id) {
    return res.status(401).json({
      success: false,
      message: "Authentication required.",
    });
  }

  const { newPassword, confirmPassword, password, resetToken, otp } = req.body;
  const user = await User.findById(req.user._id);

  if (!user) {
    return res.status(404).json({
      success: false,
      message: "User account not found.",
    });
  }

  // Enforce email verification
  if (!user.isVerified) {
    return res.status(403).json({
      success: false,
      code: "EMAIL_UNVERIFIED",
      message: "Email verification is required before setting or changing your password. Please verify your email first.",
    });
  }

  const targetPassword = newPassword || password;
  if (!targetPassword || targetPassword.length < 8) {
    return res.status(400).json({
      success: false,
      message: "Password must be at least 8 characters long.",
    });
  }

  if (confirmPassword && targetPassword !== confirmPassword) {
    return res.status(400).json({
      success: false,
      message: "Passwords do not match.",
    });
  }

  if (!resetToken) {
    return res.status(400).json({
      success: false,
      message: "Authorization token is required. Please verify your verification code first.",
    });
  }

  // Strict Authorization Verification:
  // Requires valid signed resetToken bound to the user and a verified OTP record
  let authorized = false;
  let matchedOtpId = null;

  try {
    const decoded = jwt.verify(resetToken, process.env.JWT_SECRET);
    if (!decoded || decoded.purpose !== "PASSWORD_CHANGE") {
      return res.status(400).json({
        success: false,
        message: "Invalid authorization token purpose.",
      });
    }

    if (decoded.userId !== user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Authorization token does not match authenticated user.",
      });
    }

    const otpDoc = await OTP.findById(decoded.otpId);
    if (!otpDoc || !otpDoc.verified) {
      return res.status(400).json({
        success: false,
        message: "Verification code has already been used or expired. Please request a new code.",
      });
    }

    authorized = true;
    matchedOtpId = otpDoc._id;
  } catch (_jwtErr) {
    return res.status(400).json({
      success: false,
      message: "Invalid or expired authorization token. Please verify your verification code again.",
    });
  }

  // Hash new password
  const hashedPassword = await hashPassword(targetPassword);

  // Update password in DB while safely preserving Google provider & identities
  user.password = hashedPassword;
  user.hasPassword = true;
  user.refreshToken = "";
  await user.save();

  // Invalidate authorization state & consume OTPs to prevent replay attacks
  await deleteOTP(user.email, "CHANGE_PASSWORD");
  await deleteOTP(user.email, "CREATE_PASSWORD");
  await deleteOTP(user.email, "PASSWORD_RESET");

  // Invalidate all active sessions for security
  await revokeAllSessions(user._id);

  // Send confirmation email
  try {
    await sendEmail({
      to: user.email,
      subject: "Security Alert: Password Changed",
      html: passwordChangedTemplate(user.fullName),
    });
  } catch (emailError) {
    console.error("❌ Failed to send password changed confirmation email:", emailError.message);
  }

  const clientInfo = parseClientInfo(req);
  await securityGatewayService.logSecurityEvent({
    eventType: "PASSWORD_CHANGED",
    severity: "LOW",
    requestId: clientInfo.requestId,
    ipAddress: clientInfo.ipAddress,
    userAgent: clientInfo.userAgent,
    browser: clientInfo.browser,
    operatingSystem: clientInfo.operatingSystem,
    device: clientInfo.device,
    endpoint: "/api/profile/change-password",
    httpMethod: "PATCH",
    userId: user._id,
    userEmail: user.email,
    actionTaken: "ALLOWED",
    reason: "User password updated successfully via email OTP verification.",
    riskScore: 0,
    gatewayDecision: "NORMAL",
  });

  res.status(200).json({
    success: true,
    message: "Password updated successfully. You can now use this password to sign in.",
    user: sanitizeUser(user),
  });
});

/* ==========================================================================
   7 & 8. Aliases for Create Password (Google OAuth accounts)
========================================================================== */
const requestCreatePasswordOTP = requestChangePasswordOTP;
const createPassword = changeUserPassword;

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

/* ==========================================================================
   10. User Login History & Security Activity
========================================================================== */
const getLoginHistory = asyncHandler(async (req, res) => {
  const { page, limit, eventType } = req.query;
  const history = await loginSecurityService.getUserLoginHistory(req.user._id, {
    page,
    limit,
    eventType,
  });
  res.status(200).json({ success: true, ...history });
});

/* ==========================================================================
   11. Recognized Devices Management
========================================================================== */
const getRecognizedDevices = asyncHandler(async (req, res) => {
  const currentDeviceId = deviceService.resolveDeviceId(req, res);
  const devices = await deviceService.getUserRecognizedDevices(req.user._id, currentDeviceId);
  res.status(200).json({ success: true, devices });
});

const revokeRecognizedDevice = asyncHandler(async (req, res) => {
  const { deviceId } = req.params;
  if (!deviceId) {
    return res.status(400).json({ success: false, message: "Device ID is required." });
  }
  const result = await deviceService.revokeDevice(req.user._id, deviceId);
  res.status(200).json({
    success: true,
    message: "Device recognition revoked and associated sessions terminated.",
    ...result,
  });
});

/* ==========================================================================
   12. Secure Account (One-Click Emergency Protection)
========================================================================== */
const secureAccount = asyncHandler(async (req, res) => {
  const currentSessionToken = req.cookies?.token || req.headers.authorization?.split(" ")[1];

  let filter = { user: req.user._id };
  if (currentSessionToken) {
    filter.refreshToken = { $ne: currentSessionToken };
  }
  const revokeResult = await Session.updateMany(filter, { isRevoked: true, isCurrent: false });

  // Mark pending suspicious/high-risk login events as reviewed
  await LoginEvent.updateMany(
    {
      userId: req.user._id,
      riskLevel: { $in: ["HIGH", "CRITICAL", "MEDIUM"] },
      userReviewStatus: "PENDING",
    },
    { userReviewStatus: "SUSPICIOUS", investigationStatus: "UNDER_INVESTIGATION" }
  );

  res.status(200).json({
    success: true,
    message: "Account protection activated: All other active sessions terminated.",
    revokedSessionsCount: revokeResult.modifiedCount || 0,
  });
});

/* ==========================================================================
   13. User Review Suspicious Login Event
========================================================================== */
const reviewLoginEvent = asyncHandler(async (req, res) => {
  const { eventId } = req.params;
  const { status } = req.body;

  if (!status || !["RECOGNIZED", "SUSPICIOUS"].includes(status)) {
    return res.status(400).json({
      success: false,
      message: "Status must be either RECOGNIZED or SUSPICIOUS.",
    });
  }

  const updated = await loginSecurityService.userReviewLoginEvent(req.user._id, eventId, status);
  if (!updated) {
    return res.status(404).json({ success: false, message: "Login event not found." });
  }

  res.status(200).json({
    success: true,
    message: `Event marked as ${status.toLowerCase()}.`,
    event: updated,
  });
});

module.exports = {
  getProfile,
  updateUserProfile,
  uploadProfilePicture,
  deleteAccount,
  changeUserPassword,
  requestChangePasswordOTP,
  verifyChangePasswordOTP,
  requestCreatePasswordOTP,
  createPassword,
  getUserSessions,
  logoutSession,
  requestEmailChangeOTP,
  verifyEmailChangeOTP,
  requestVerifyEmailOTP,
  confirmVerifyEmailOTP,
  getLoginHistory,
  getRecognizedDevices,
  revokeRecognizedDevice,
  secureAccount,
  reviewLoginEvent,
};