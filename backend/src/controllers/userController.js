const asyncHandler = require("../utils/asyncHandler");
const User = require("../models/User");
const Session = require("../models/Session");
const hashPassword = require("../utils/hashPassword");
const sanitizeUser = require("../utils/sanitizeData");
const generateOTP = require("../utils/generateOTP");
const hashOTP = require("../utils/hashOTP");
const compareOTP = require("../utils/compareOTP");
const sendEmail = require("../services/emailService");
const otpTemplate = require("../templates/email/otpTemplate");
const { createOTP, deleteOTP, findOTPByEmailAndType } = require("../services/otpService");
const {
  isProtectedSuperAdmin,
  isSuperAdmin,
  isAdmin,
  canChangeRole,
  canBlockUser,
  canDeleteUser,
} = require("../utils/authHelpers");

// Get all users for admin directory with search & role filter
const getAllUsers = asyncHandler(async (req, res) => {
  const { search = "", role = "all" } = req.query;

  const query = {};

  if (search) {
    query.$or = [
      { fullName: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
    ];
  }

  if (role !== "all") {
    query.role = role;
  }

  const users = await User.find(query).sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    count: users.length,
    users: users.map((u) => {
      const sanitized = sanitizeUser(u);
      if (isProtectedSuperAdmin(u)) {
        sanitized.role = "super_admin";
      }
      return sanitized;
    }),
  });
});

// Step 1: Request OTP for Creating/Promoting Admin Account
const requestCreateAdminOTP = asyncHandler(async (req, res) => {
  const { fullName, email, password } = req.body;

  if (!email) {
    return res.status(400).json({
      success: false,
      message: "Email address is required.",
    });
  }

  const normalizedEmail = email.toLowerCase().trim();
  const existingUser = await User.findOne({ email: normalizedEmail });
  const targetName = fullName || (existingUser ? existingUser.fullName : "Admin User");

  const otp = generateOTP();
  const hashedOTP = await hashOTP(otp);

  await deleteOTP(email.toLowerCase(), "CREATE_ADMIN");
  await createOTP({
    email: email.toLowerCase(),
    otp: hashedOTP,
    type: "CREATE_ADMIN",
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
  });

  // Send REAL email OTP directly to recipient email inbox!
  try {
    await sendEmail({
      to: email,
      subject: "🔐 Admin Account Verification OTP Code",
      html: otpTemplate(targetName, otp, 10),
    });
  } catch (err) {
    console.error("Email dispatch for admin OTP failed:", err.message);
    return res.status(500).json({
      success: false,
      message: `Failed to deliver verification code email to ${email}. Please try again later.`,
    });
  }

  // DO NOT send OTP back in API response for security!
  res.status(200).json({
    success: true,
    message: `Verification OTP code sent to ${email}`,
  });
});

// Step 2: Confirm OTP & Finalize Admin Account Creation / Promotion
const confirmCreateAdminOTP = asyncHandler(async (req, res) => {
  const { fullName, email, password, otp } = req.body;

  if (!email || !otp) {
    return res.status(400).json({
      success: false,
      message: "Email and OTP code are required.",
    });
  }

  // Strict OTP Verification against MongoDB database
  const otpRecord = await findOTPByEmailAndType(email.toLowerCase(), "CREATE_ADMIN");
  
  if (!otpRecord) {
    return res.status(400).json({
      success: false,
      message: "OTP expired or invalid. Please request a new verification code.",
    });
  }

  const matched = await compareOTP(otp, otpRecord.otp);
  if (!matched) {
    return res.status(400).json({
      success: false,
      message: "Incorrect verification OTP code. Please check your email inbox.",
    });
  }

  await deleteOTP(email.toLowerCase(), "CREATE_ADMIN");

  const existingUser = await User.findOne({ email: email.toLowerCase() });
  
  // If user account exists, promote role from "user" to "admin" and update password if provided
  if (existingUser) {
    existingUser.role = "admin";
    existingUser.isVerified = true;
    if (fullName) existingUser.fullName = fullName;
    if (password) existingUser.password = await hashPassword(password);
    await existingUser.save();

    return res.status(200).json({
      success: true,
      message: `User account ${email} successfully promoted to Admin!`,
      user: sanitizeUser(existingUser),
    });
  }

  // Create new Admin account if no account exists yet
  if (!fullName || !password) {
    return res.status(400).json({
      success: false,
      message: "Full name and password are required for new account creation.",
    });
  }

  const hashedPassword = await hashPassword(password);
  const newAdmin = await User.create({
    fullName,
    email: email.toLowerCase(),
    password: hashedPassword,
    role: "admin",
    isVerified: true,
    provider: "local",
  });

  res.status(201).json({
    success: true,
    message: `Admin account created successfully for ${email}! They can now log in.`,
    user: sanitizeUser(newAdmin),
  });
});

// Promote or demote user role
const updateUserRole = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { role } = req.body;

  if (!["user", "admin", "super_admin"].includes(role)) {
    return res.status(400).json({
      success: false,
      message: "Invalid role specified.",
    });
  }

  const targetUser = await User.findById(userId);
  if (!targetUser) {
    return res.status(404).json({
      success: false,
      message: "User not found.",
    });
  }

  const authCheck = canChangeRole(req.user, targetUser, role);
  if (!authCheck.allowed) {
    return res.status(403).json({
      success: false,
      message: authCheck.reason,
    });
  }

  targetUser.role = role;
  await targetUser.save();

  res.status(200).json({
    success: true,
    message: `User ${targetUser.email} role updated to ${role}`,
    user: sanitizeUser(targetUser),
  });
});

// Toggle User Block Status
const toggleUserBlock = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  const targetUser = await User.findById(userId);
  if (!targetUser) {
    return res.status(404).json({
      success: false,
      message: "User not found.",
    });
  }

  if (!targetUser.isBlocked) {
    const authCheck = canBlockUser(req.user, targetUser);
    if (!authCheck.allowed) {
      return res.status(403).json({
        success: false,
        message: authCheck.reason,
      });
    }

    targetUser.isBlocked = true;
    targetUser.blockedUntil = new Date(Date.now() + 15 * 60 * 1000); // 15-minute default
    targetUser.blockReason = "Manually restricted by administrator";
    targetUser.blockSource = "ADMIN_MANUAL";
    targetUser.blockedAt = new Date();
    targetUser.blockedBy = req.user._id;
  } else {
    if (isProtectedSuperAdmin(targetUser)) {
      return res.status(403).json({
        success: false,
        message: "Protected Super Admin cannot be blocked or restricted.",
      });
    }
    targetUser.isBlocked = false;
    targetUser.blockedUntil = null;
    targetUser.blockReason = "";
    targetUser.blockSource = null;
    targetUser.blockedAt = null;
    targetUser.blockedBy = null;
  }

  await targetUser.save();

  res.status(200).json({
    success: true,
    message: `User ${targetUser.email} is now ${targetUser.isBlocked ? "blocked" : "active"}`,
    user: sanitizeUser(targetUser),
  });
});

// Delete user account (Admin only)
const deleteUser = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  const targetUser = await User.findById(userId);
  if (!targetUser) {
    return res.status(404).json({
      success: false,
      message: "User not found.",
    });
  }

  const authCheck = canDeleteUser(req.user, targetUser);
  if (!authCheck.allowed) {
    return res.status(403).json({
      success: false,
      message: authCheck.reason,
    });
  }

  await User.findByIdAndDelete(userId);
  await Session.deleteMany({ user: userId });

  res.status(200).json({
    success: true,
    message: `User ${targetUser.email} deleted successfully.`,
  });
});

// Get Admin System Analytics & Audit Transactions
const getAdminAnalytics = asyncHandler(async (req, res) => {
  const totalUsers = await User.countDocuments({ role: "user" });
  const totalAdmins = await User.countDocuments({ role: "admin" });
  const verifiedUsers = await User.countDocuments({ isVerified: true });
  const totalSessions = await Session.countDocuments({});

  const recentSessions = await Session.find({})
    .populate("user", "fullName email role profilePicture")
    .sort({ createdAt: -1 })
    .limit(20);

  res.status(200).json({
    success: true,
    analytics: {
      totalUsers,
      totalAdmins,
      verifiedUsers,
      totalSessions,
      verificationRate: totalUsers + totalAdmins > 0 ? Math.round((verifiedUsers / (totalUsers + totalAdmins)) * 100) : 100,
    },
    auditLogs: recentSessions,
  });
});

module.exports = {
  getAllUsers,
  requestCreateAdminOTP,
  confirmCreateAdminOTP,
  updateUserRole,
  toggleUserBlock,
  deleteUser,
  getAdminAnalytics,
};
