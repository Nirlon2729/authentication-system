const asyncHandler = require("../utils/asyncHandler");
const hashPassword = require("../utils/hashPassword");
const generateJWT = require("../utils/generateJWT");
const sanitizeUser = require("../utils/sanitizeData");
const comparePassword = require("../utils/comparePassword");
const generateOTP = require("../utils/generateOTP");
const otpTemplate = require("../templates/email/otpTemplate");
const sendEmail = require("../services/emailService");
const hashOTP = require("../utils/hashOTP");
const compareOTP = require("../utils/compareOTP");
const { verifyGoogleToken } = require("../services/googleAuthService");
const welcomeTemplate = require("../templates/email/welcomeTemplate");
const UAParser = require("ua-parser-js");
const {
  createSession,
} = require("../services/sessionService");
const emailChangedOldTemplate = require("../templates/email/emailChangedOldTemplate");
const emailChangedNewTemplate = require("../templates/email/emailChangedNewTemplate");
const {
  createOTP,
  deleteOTP,
  findOTPByEmailAndType,
  incrementAttempts,
  verifyOTP,
  findVerifiedOTP,
  findVerifiedOTPByType,
} = require("../services/otpService");

const {
  createUser,
  createGoogleUser,
  findUserByEmail,
  findUserByGoogleId,
  updateLastLogin,
  updateRefreshToken,
} = require("../services/authService");

const logout = asyncHandler(async (req, res) => {
  res.clearCookie("token");

  res.status(200).json({
    success: true,
    message: "Logout successful.",
  });

}); const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;

  const user = await findUserByEmail(email);

  if (!user) {
    return res.status(404).json({
      success: false,
      message: "Email not registered.",
    });
  }

  // Remove previous OTPs
  await deleteOTP(email);

  const otp = generateOTP();

  const hashedOTP = await hashOTP(otp);

  await createOTP({
  user: user._id,
  email: user.email,
  phone: user.phone,
  otp: hashedOTP,
  type: req.body.type || "PASSWORD_RESET",
  deliveryMethod: "EMAIL",
  expiresAt: new Date(Date.now() + 10 * 60 * 1000),
});

  await sendEmail({
    to: user.email,
    subject: "Password Reset OTP",
    html: otpTemplate(user.fullName, otp),
  });

  res.status(200).json({
    success: true,
    message: "OTP sent successfully.",
  });
});
const signupRequest = asyncHandler(async (req, res) => {
  const {
    fullName,
    email,
    phone,
    password,
  } = req.body;

  const existingUser = await findUserByEmail(email);

  if (existingUser) {
    return res.status(409).json({
      success: false,
      message: "Email already registered.",
    });
  }

  // Remove previous signup OTP if any
  await deleteOTP(email);

  const hashedPassword = await hashPassword(password);

  const otp = generateOTP();

  const hashedOTP = await hashOTP(otp);

  await createOTP({
    email,
    phone,
    otp: hashedOTP,
    type: "SIGNUP",
    deliveryMethod: "EMAIL",
    expiresAt: new Date(
      Date.now() + 10 * 60 * 1000
    ),

    signupData: {
      fullName,
      phone,
      password: hashedPassword,
    },
  });

  await sendEmail({
    to: email,
    subject: "Verify your email",
    html: otpTemplate(fullName, otp),
  });

  res.status(200).json({
    success: true,
    message: "OTP sent successfully.",
  });
});
const signupComplete = asyncHandler(async (req, res) => {
  const { email } = req.body;

  // Find verified SIGNUP OTP
  const otpRecord =
    await findVerifiedOTPByType(
      email,
      "SIGNUP"
    );

  if (!otpRecord) {
    return res.status(400).json({
      success: false,
      message:
        "Please verify your OTP first.",
    });
  }

  // Email already registered?
  const existingUser =
    await findUserByEmail(email);

  if (existingUser) {
    await deleteOTP(email);

    return res.status(409).json({
      success: false,
      message:
        "Email already registered.",
    });
  }

  // Create user
  const user = await createUser({
    fullName:
      otpRecord.signupData.fullName,
    email,
    phone:
      otpRecord.signupData.phone,
    password:
      otpRecord.signupData.password,
  });

  // Welcome Email
  try {
    await sendEmail({
      to: user.email,
      subject: "Welcome to Auth Portal 🎉",
      html: welcomeTemplate(user.fullName),
    });
  } catch (emailError) {
    console.error("❌ Failed to send welcome email:", emailError.message);
  }

  // JWT
  const token = generateJWT({
    id: user._id,
    email: user.email,
    role: user.role,
    provider: user.provider,
  });

  await updateLastLogin(user._id);
  await updateRefreshToken(
    user._id,
    token
  );

  await deleteOTP(email);

  res.status(201).json({
    success: true,
    message:
      "Account created successfully.",
    token,
    user: sanitizeUser(user),
  });
});
const signup = asyncHandler(async (req, res) => {
  const {
    fullName,
    email,
    phone,
    password,
  } = req.body;

  const existingUser = await findUserByEmail(email);

  if (existingUser) {
    return res.status(409).json({
      success: false,
      message: "Email already registered.",
    });
  }

  const hashedPassword = await hashPassword(password);

  const user = await createUser({
    fullName,
    email,
    phone,
    password: hashedPassword,
  });

  // Welcome Email
  try {
    await sendEmail({
      to: user.email,
      subject: "Welcome to Auth Portal 🎉",
      html: welcomeTemplate(user.fullName),
    });
  } catch (emailError) {
    console.error("❌ Failed to send welcome email:", emailError.message);
  }

  const token = generateJWT({
    id: user._id,
    email: user.email,
    role: user.role,
    provider: user.provider,
  });

  res.status(201).json({
    success: true,
    message: "Account created successfully.",
    token,
    user: sanitizeUser(user),
  });
});
const login = asyncHandler(async (req, res) => {
  const {
  email,
  password,
  remember = false,
} = req.body;

  const user = await findUserByEmail(email);

  if (!user) {
    return res.status(401).json({
      success: false,
      message: "Invalid email or password.",
    });
  }

  if (user.isBlocked) {
    return res.status(403).json({
      success: false,
      message: "Your account has been blocked.",
    });
  }

  const isMatch = await comparePassword(
    password,
    user.password
  );

  if (!isMatch) {
    return res.status(401).json({
      success: false,
      message: "Invalid email or password.",
    });
  }

  const token = generateJWT({
    id: user._id,
    email: user.email,
    role: user.role,
    provider: user.provider,
  });

  await updateLastLogin(user._id);

  await updateRefreshToken(user._id, token);
const parser = new UAParser(
  req.headers["user-agent"]
);

const result = parser.getResult();

await createSession({
  user: user._id,

  refreshToken: token,

  rememberMe: remember,

  browser:
    result.browser.name || "Unknown Browser",

  operatingSystem:
    result.os.name || "Unknown OS",

  device:
    result.device.type || "Desktop",

  ipAddress:
    req.ip ||
    req.connection.remoteAddress,

  location: "",

  userAgent:
    req.headers["user-agent"],

  isCurrent: true,

  expiresAt: new Date(
    Date.now() +
      (remember ? 30 : 1) *
        24 *
        60 *
        60 *
        1000
  ),
});
  res.status(200).json({
    success: true,
    message: "Login successful.",
    token,
    user: sanitizeUser(user),
  });
});
const googleLogin = asyncHandler(async (req, res) => {
  const { idToken, remember = false } = req.body;

  if (!idToken) {
    return res.status(400).json({
      success: false,
      message: "Google token is required.",
    });
  }

  const googleUser = await verifyGoogleToken(idToken);

  let user = await findUserByGoogleId(googleUser.uid);

  if (!user) {
    user = await findUserByEmail(googleUser.email);
  }

  if (!user) {
    user = await createGoogleUser({
      fullName: googleUser.fullName,
      email: googleUser.email,
      googleId: googleUser.uid,
      provider: "google",
      profilePicture: googleUser.profilePicture,
      isVerified: googleUser.emailVerified,
      password: "",
      hasPassword: false,
    });

    // Welcome Email
    try {
      await sendEmail({
        to: user.email,
        subject: "Welcome to Auth Portal 🎉",
        html: welcomeTemplate(user.fullName),
      });
    } catch (emailError) {
      console.error("❌ Failed to send Google welcome email:", emailError.message);
    }
  }

  const token = generateJWT({
    id: user._id,
    email: user.email,
    role: user.role,
    provider: user.provider,
  });

  // Update Last Login
  await updateLastLogin(user._id);

  // Store Refresh Token
  await updateRefreshToken(user._id, token);

  res.status(200).json({
    success: true,
    message: "Google Login successful.",
    token,
    user: sanitizeUser(user),
  });
  await createSession({
  user: user._id,

  refreshToken: token,

  rememberMe: remember,

  device: "Desktop",

  browser: "Unknown Browser",

  operatingSystem: "Unknown OS",

  ipAddress:
    req.ip ||
    req.connection.remoteAddress,

  userAgent:
    req.headers["user-agent"],

  isCurrent: true,

  expiresAt: new Date(
    Date.now() +
      (remember ? 30 : 1) *
        24 *
        60 *
        60 *
        1000
  ),
});
});
const verifyOTPController = asyncHandler(async (req, res) => {
  const {
  email,
  otp,
  type = "PASSWORD_RESET",
} = req.body;

  const otpRecord =
  await findOTPByEmailAndType(
    email,
    type
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
      message: "Maximum OTP attempts exceeded.",
    });
  }

  const matched = await compareOTP(
    otp,
    otpRecord.otp
  );

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



const resetPassword = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const otpRecord = await findVerifiedOTP(email);

  if (!otpRecord) {
    return res.status(400).json({
      success: false,
      message: "OTP verification required.",
    });
  }

  const user = await findUserByEmail(email);

  if (!user) {
    return res.status(404).json({
      success: false,
      message: "User not found.",
    });
  }

  const hashedPassword = await hashPassword(password);

  user.password = hashedPassword;

  await user.save();

  await deleteOTP(email);

  res.status(200).json({
    success: true,
    message: "Password reset successfully.",
  });
});
module.exports = {
  signupRequest,
  signupComplete,
  signup,
  login,
  logout,
  forgotPassword,
  verifyOTPController,
  resetPassword,
  googleLogin,
};