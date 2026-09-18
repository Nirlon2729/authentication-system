const asyncHandler = require("../utils/asyncHandler");
const generateOTP = require("../utils/generateOTP");
const hashOTP = require("../utils/hashOTP");
const compareOTP = require("../utils/compareOTP");
const otpTemplate = require("../templates/email/otpTemplate");
const sendEmail = require("../services/emailService");
const {
  createOTP,
  deleteOTP,
  findOTPByEmailAndType,
  verifyOTP,
  incrementAttempts,
} = require("../services/otpService");
const { findUserByEmail } = require("../services/authService");

const sendOTP = asyncHandler(async (req, res) => {
  const { email, type = "EMAIL_VERIFICATION" } = req.body;

  if (!email) {
    return res.status(400).json({
      success: false,
      message: "Email is required.",
    });
  }

  const normalizedEmail = email.toLowerCase().trim();
  const existingUser = await findUserByEmail(normalizedEmail);
  const targetName = existingUser ? existingUser.fullName : "User";

  await deleteOTP(normalizedEmail, type);

  const otp = generateOTP();
  const hashedOTP = await hashOTP(otp);
  const otpExpireMinutes = Number(process.env.OTP_EXPIRE_MINUTES) || 10;

  await createOTP({
    user: existingUser ? existingUser._id : null,
    email: normalizedEmail,
    otp: hashedOTP,
    type,
    deliveryMethod: "EMAIL",
    expiresAt: new Date(Date.now() + otpExpireMinutes * 60 * 1000),
  });

  try {
    await sendEmail({
      to: normalizedEmail,
      subject: "Your Verification Code",
      html: otpTemplate(targetName, otp, otpExpireMinutes),
    });
  } catch (emailError) {
    console.error("❌ Failed to send OTP email:", emailError.message);
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

const verifyOTPHandler = asyncHandler(async (req, res) => {
  const { email, otp, type = "EMAIL_VERIFICATION" } = req.body;

  if (!email || !otp) {
    return res.status(400).json({
      success: false,
      message: "Email and OTP code are required.",
    });
  }

  const normalizedEmail = email.toLowerCase().trim();
  const otpRecord = await findOTPByEmailAndType(normalizedEmail, type);

  if (!otpRecord) {
    return res.status(404).json({
      success: false,
      message: "OTP not found or expired.",
    });
  }

  if (otpRecord.expiresAt < new Date()) {
    await deleteOTP(normalizedEmail, type);
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

  await verifyOTP(otpRecord._id);

  res.status(200).json({
    success: true,
    message: "OTP verified successfully.",
  });
});

module.exports = {
  sendOTP,
  verifyOTP: verifyOTPHandler,
};
