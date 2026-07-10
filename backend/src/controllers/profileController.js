const asyncHandler = require("../utils/asyncHandler");
const generateOTP = require("../utils/generateOTP");
const hashOTP = require("../utils/hashOTP");
const changeEmailOTPTemplate = require("../templates/email/changeEmailOTPTemplate");
const generateJWT = require("../utils/generateJWT");
const sanitizeUser = require("../utils/sanitizeData");
const otpTemplate = require("../templates/email/otpTemplate");
const sendEmail = require("../services/emailService");
const compareOTP = require("../utils/compareOTP");
const emailChangedOldTemplate = require("../templates/email/emailChangedOldTemplate");
const emailChangedNewTemplate = require("../templates/email/emailChangedNewTemplate");
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
  incrementAttempts,
   findVerifiedOTP,
} = require("../services/otpService");
const {
  findUserByEmail,
  updateUserEmail,
} = require("../services/authService");
const hashPassword = require("../utils/hashPassword");
const comparePassword = require("../utils/comparePassword");
const {
  deleteAccountService,
} = require("../services/accountService");
const {
  findUserSessions,
  revokeSession,
} = require("../services/sessionService");


const getProfile = asyncHandler(async (req, res) => {
  res.status(200).json({
    success: true,
    user: req.user,
  });
});

const updateUserProfile = async (req, res) => {
  try {
    const { fullName, phone } = req.body;

    const updatedUser = await updateProfile(req.user._id, {
      fullName,
      phone,
    });

    res.status(200).json({
      success: true,
      message: "Profile updated successfully.",
      user: updatedUser,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const uploadProfilePicture = async (req, res) => {
  try {
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
      user: updatedUser,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const deleteAccount = async (req, res) => {
  try {
    // Local account
    if (req.user.provider === "local") {
      const { password } = req.body;

      if (!password) {
        return res.status(400).json({
          success: false,
          message: "Password is required.",
        });
      }

      const isMatch = await comparePassword(
        password,
        req.user.password
      );

      if (!isMatch) {
        return res.status(401).json({
          success: false,
          message: "Incorrect password.",
        });
      }
    }

    // Google account skips password verification

    await deleteAccountService(req.user);

    res.status(200).json({
      success: true,
      message: "Account deleted successfully.",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
const changeUserPassword = async (req, res) => {
  try {
    const {
      currentPassword,
      newPassword,
    } = req.body;

    if (req.user.provider !== "local") {
      return res.status(400).json({
        success: false,
        message:
          "Google accounts cannot change password.",
      });
    }

    const isMatch = await comparePassword(
      currentPassword,
      req.user.password
    );

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Current password is incorrect.",
      });
    }

    const hashedPassword = await hashPassword(
      newPassword
    );

    await changePassword(
      req.user._id,
      hashedPassword
    );

    res.status(200).json({
      success: true,
      message: "Password changed successfully.",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
const requestCreatePasswordOTP = async (req, res) => {
  try {
    if (req.user.provider !== "google") {
      return res.status(400).json({
        success: false,
        message: "Only Google accounts can create a password.",
      });
    }

    if (req.user.hasPassword) {
      return res.status(400).json({
        success: false,
        message: "Password already exists.",
      });
    }

    await deleteOTP(req.user.email);

    const otp = generateOTP();

    const hashedOTP = await hashOTP(otp);

    await createOTP({
      user: req.user._id,
      email: req.user.email,
      phone: req.user.phone,
      otp: hashedOTP,
      type: "CREATE_PASSWORD",
      deliveryMethod: "EMAIL",
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });

    await sendEmail({
      to: req.user.email,
      subject: "Create Password OTP",
      html: otpTemplate(req.user.fullName, otp),
    });

    res.status(200).json({
      success: true,
      message: "OTP sent successfully.",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
const createPassword = async (req, res) => {
  try {
    const { password } = req.body;

    if (req.user.provider !== "google") {
      return res.status(400).json({
        success: false,
        message: "Only Google accounts can create a password.",
      });
    }

    if (req.user.hasPassword) {
      return res.status(400).json({
        success: false,
        message: "Password already exists.",
      });
    }

    const otpRecord = await findVerifiedOTP(
      req.user.email
    );

    if (!otpRecord) {
      return res.status(400).json({
        success: false,
        message: "OTP verification required.",
      });
    }

    const hashedPassword =
      await hashPassword(password);

    const updatedUser = await updateProfile(
      req.user._id,
      {
        password: hashedPassword,
        hasPassword: true,
      }
    );

    await deleteOTP(req.user.email);

    res.status(200).json({
      success: true,
      message: "Password created successfully.",
      user: updatedUser,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
const getUserSessions = asyncHandler(
  async (req, res) => {
    const sessions =
      await findUserSessions(req.user.id);

    res.status(200).json({
      success: true,
      sessions,
    });
  }
);
const Session = require("../models/Session");

const logoutSession = asyncHandler(
  async (req, res) => {
    const { sessionId } = req.params;

    const session = await Session.findOne({
      _id: sessionId,
      user: req.user.id,
      isRevoked: false,
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        message: "Session not found.",
      });
    }

    await revokeSession(sessionId);

    res.status(200).json({
      success: true,
      message:
        "Session logged out successfully.",
    });
  }
);
const requestEmailChangeOTP = asyncHandler(
  async (req, res) => {
    const {
      newEmail,
      password,
    } = req.body;
    if (!password) {
      return res.status(400).json({
        success: false,
        message: "Password is required.",
      });
    }
    if (req.user.provider === "local") {
      const isMatch =
        await comparePassword(
          password,
          req.user.password
        );

      if (!isMatch) {
        return res.status(401).json({
          success: false,
          message:
            "Incorrect password.",
        });
      }
    }
    if (!newEmail) {
      return res.status(400).json({
        success: false,
        message: "New email is required.",
      });
    }

    // Check if email already exists
    const existingUser =
      await findUserByEmail(newEmail);

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message:
          "Email is already registered.",
      });
    }

    // Delete previous OTP
    await deleteOTP(newEmail);

    // Generate OTP
    const otp = generateOTP();

    const hashedOTP =
      await hashOTP(otp);

    // Save OTP
    await createOTP({
      user: req.user.id,
      email: newEmail,
      otp: hashedOTP,
      type: "CHANGE_EMAIL",
      deliveryMethod: "EMAIL",
      expiresAt: new Date(
        Date.now() +
        10 * 60 * 1000
      ),
    });

    // Send email
    await sendEmail({
      to: newEmail,
      subject:
        "Verify Your New Email",
      html: changeEmailOTPTemplate(
        req.user.fullName,
        otp
      ),
    });

    res.status(200).json({
      success: true,
      message:
        "OTP sent successfully.",
    });
  }
);
const verifyEmailChangeOTP = asyncHandler(
  async (req, res) => {
    const { newEmail, otp } = req.body;

    const otpRecord =
      await findOTPByEmailAndType(
        newEmail,
        "CHANGE_EMAIL"
      );

    if (!otpRecord) {
      return res.status(404).json({
        success: false,
        message: "OTP not found.",
      });
    }

    if (otpRecord.expiresAt < new Date()) {
      return res.status(400).json({
        success: false,
        message: "OTP has expired.",
      });
    }

    if (otpRecord.attempts >= 5) {
      return res.status(400).json({
        success: false,
        message:
          "Maximum OTP attempts exceeded.",
      });
    }

    const matched =
      await compareOTP(
        otp,
        otpRecord.otp
      );

    if (!matched) {
      await incrementAttempts(
        otpRecord._id
      );

      return res.status(400).json({
        success: false,
        message: "Invalid OTP.",
      });
    }

    // Mark OTP verified
    await verifyOTP(otpRecord._id);

    // Save old email
    const oldEmail = req.user.email;

    // Update user's email
    const user = await updateUserEmail(
      req.user.id,
      newEmail
    );

    // Generate new JWT
    const token = generateJWT({
      id: user._id,
      email: user.email,
      role: user.role,
      provider: user.provider,
    });

    // Notify old email
    await sendEmail({
      to: oldEmail,
      subject: "Your Email Address Was Changed",
      html: emailChangedOldTemplate(
        user.fullName,
        user.email
      ),
    });

    // Notify new email
    await sendEmail({
      to: user.email,
      subject: "Email Changed Successfully",
      html: emailChangedNewTemplate(
        user.fullName
      ),
    });

    // Delete OTP
    await deleteOTP(newEmail);

    res.status(200).json({
      success: true,
      message:
        "Email changed successfully.",
      token,
      user: sanitizeUser(user),
    });
  }
);
module.exports = {
  getProfile,
  updateUserProfile,
  uploadProfilePicture,
  deleteAccount,
  changeUserPassword,
  requestCreatePasswordOTP,
  createPassword,
  getUserSessions,
  logoutSession,
  requestEmailChangeOTP,
  verifyEmailChangeOTP,
};