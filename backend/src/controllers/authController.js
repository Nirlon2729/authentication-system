const crypto = require("crypto");
const asyncHandler = require("../utils/asyncHandler");
const hashPassword = require("../utils/hashPassword");
const comparePassword = require("../utils/comparePassword");
const sanitizeUser = require("../utils/sanitizeData");
const generateOTP = require("../utils/generateOTP");
const hashOTP = require("../utils/hashOTP");
const compareOTP = require("../utils/compareOTP");
const otpTemplate = require("../templates/email/otpTemplate");
const welcomeTemplate = require("../templates/email/welcomeTemplate");
const sendEmail = require("../services/emailService");
const { sendNewLoginNotification } = require("../services/emailService");
const { verifyGoogleToken } = require("../services/googleAuthService");
const { generateTokens } = require("../services/tokenService");
const UAParser = require("ua-parser-js");
const {
  createSession,
  revokeCurrentSession,
  revokeAllSessions,
} = require("../services/sessionService");
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
const securityGatewayService = require("../services/securityGatewayService");

/* ==========================================================================
   Helper: Parse Device & User-Agent details
========================================================================== */
const parseClientInfo = (req) => {
  const userAgentString = req.headers["user-agent"] || "";
  let browser = "Unknown Browser";
  let operatingSystem = "Unknown OS";
  let device = "Desktop";

  try {
    const parser = new UAParser(userAgentString);
    const result = parser.getResult();
    browser = result.browser.name ? `${result.browser.name} ${result.browser.version || ""}`.trim() : "Unknown Browser";
    operatingSystem = result.os.name ? `${result.os.name} ${result.os.version || ""}`.trim() : "Unknown OS";
    device = result.device.type || (result.device.model ? result.device.model : "Desktop");
  } catch (err) {
    console.error("UA parser fallback error:", err.message);
  }

  const ipAddress =
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.socket?.remoteAddress ||
    req.ip ||
    "127.0.0.1";

  const requestId = req.id || req.headers["x-request-id"] || crypto.randomUUID();

  return {
    browser,
    operatingSystem,
    device,
    ipAddress,
    userAgent: userAgentString,
    requestId,
  };
};

/* ==========================================================================
   Helper: Set Authentication HTTP-Only Cookie
========================================================================== */
const setAuthCookie = (res, token, remember = false) => {
  const isProduction =
    process.env.NODE_ENV === "production" &&
    !process.env.CLIENT_URL?.includes("localhost") &&
    !process.env.FRONTEND_URL?.includes("localhost");

  res.cookie("token", token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    maxAge: (remember ? 30 : 1) * 24 * 60 * 60 * 1000,
    path: "/",
  });
};

/* ==========================================================================
   1. Signup Request (Sends Email OTP)
========================================================================== */
const signupRequest = asyncHandler(async (req, res) => {
  const { fullName, email, phone, password } = req.body;

  if (!email || !password || !fullName) {
    return res.status(400).json({
      success: false,
      message: "Full name, email, and password are required.",
    });
  }

  const normalizedEmail = email.toLowerCase().trim();
  const existingUser = await findUserByEmail(normalizedEmail);

  if (existingUser) {
    return res.status(409).json({
      success: false,
      message: "Email already registered.",
    });
  }

  // Remove previous signup OTP if any
  await deleteOTP(normalizedEmail, "SIGNUP");

  const hashedPassword = await hashPassword(password);
  const otp = generateOTP();
  const hashedOTP = await hashOTP(otp);

  const otpExpireMinutes = Number(process.env.OTP_EXPIRE_MINUTES) || 10;

  await createOTP({
    email: normalizedEmail,
    phone: phone || "",
    otp: hashedOTP,
    type: "SIGNUP",
    deliveryMethod: "EMAIL",
    expiresAt: new Date(Date.now() + otpExpireMinutes * 60 * 1000),
    signupData: {
      fullName,
      phone: phone || "",
      password: hashedPassword,
    },
  });

  try {
    await sendEmail({
      to: normalizedEmail,
      subject: "Verify your email",
      html: otpTemplate(fullName, otp, otpExpireMinutes),
    });
  } catch (emailError) {
    console.error("❌ Failed to send signup OTP email:", emailError.message);
  }

  res.status(200).json({
    success: true,
    message: "OTP sent successfully.",
  });
});

/* ==========================================================================
   2. Signup Complete (After OTP is Verified)
========================================================================== */
const signupComplete = asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({
      success: false,
      message: "Email is required.",
    });
  }

  const normalizedEmail = email.toLowerCase().trim();

  // Find verified SIGNUP OTP
  const otpRecord = await findVerifiedOTPByType(normalizedEmail, "SIGNUP");

  if (!otpRecord || !otpRecord.signupData) {
    return res.status(400).json({
      success: false,
      message: "Please verify your OTP first.",
    });
  }

  // Check again if already registered
  const existingUser = await findUserByEmail(normalizedEmail);
  if (existingUser) {
    await deleteOTP(normalizedEmail, "SIGNUP");
    return res.status(409).json({
      success: false,
      message: "Email already registered.",
    });
  }

  // Create verified user
  const user = await createUser({
    fullName: otpRecord.signupData.fullName,
    email: normalizedEmail,
    phone: otpRecord.signupData.phone || "",
    password: otpRecord.signupData.password,
    provider: "local",
    isVerified: true,
    hasPassword: true,
  });

  // Welcome Email in background
  try {
    await sendEmail({
      to: user.email,
      subject: "Welcome 🎉",
      html: welcomeTemplate(user.fullName),
    });
  } catch (emailError) {
    console.error("❌ Failed to send welcome email:", emailError.message);
  }

  // Generate distinct Access and Refresh Tokens
  const { accessToken, refreshToken } = generateTokens(user, false);

  await updateLastLogin(user._id);
  await updateRefreshToken(user._id, refreshToken);

  const clientInfo = parseClientInfo(req);

  const session = await createSession({
    user: user._id,
    refreshToken,
    rememberMe: false,
    browser: clientInfo.browser,
    operatingSystem: clientInfo.operatingSystem,
    device: clientInfo.device,
    ipAddress: clientInfo.ipAddress,
    userAgent: clientInfo.userAgent,
    isCurrent: true,
    expiresAt: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
  });

  await deleteOTP(normalizedEmail, "SIGNUP");

  // Asynchronous login security notification & audit event
  sendNewLoginNotification({
    email: user.email,
    fullName: user.fullName,
    loginTime: new Date(),
    ipAddress: clientInfo.ipAddress,
    browser: clientInfo.browser,
    operatingSystem: clientInfo.operatingSystem,
    device: clientInfo.device,
    authMethod: "Signup Auto-Login",
    rememberMe: false,
    requestId: clientInfo.requestId,
    sessionId: session?._id,
  }).catch((err) => console.error("[Security] Async signup login notification error:", err.message));

  securityGatewayService.logSecurityEvent({
    eventType: "SUCCESSFUL_LOGIN",
    severity: "LOW",
    requestId: clientInfo.requestId,
    ipAddress: clientInfo.ipAddress,
    userAgent: clientInfo.userAgent,
    browser: clientInfo.browser,
    operatingSystem: clientInfo.operatingSystem,
    device: clientInfo.device,
    endpoint: "/api/auth/signup-complete",
    httpMethod: "POST",
    userId: user._id,
    userEmail: user.email,
    actionTaken: "ALLOWED",
    reason: "User registered and logged in successfully via OTP verification.",
    riskScore: 0,
    gatewayDecision: "NORMAL",
    metadata: { authMethod: "Signup Auto-Login" },
  }).catch((e) => console.error("[Security] Async login event log error:", e.message));

  // Set HTTP-Only Cookie
  setAuthCookie(res, accessToken, false);

  res.status(201).json({
    success: true,
    message: "Account created successfully.",
    token: accessToken,
    user: sanitizeUser(user),
  });
});

/* ==========================================================================
   3. Direct Signup (Optional standalone signup)
========================================================================== */
const signup = asyncHandler(async (req, res) => {
  const { fullName, email, phone, password } = req.body;

  const normalizedEmail = email.toLowerCase().trim();
  const existingUser = await findUserByEmail(normalizedEmail);

  if (existingUser) {
    return res.status(409).json({
      success: false,
      message: "Email already registered.",
    });
  }

  const hashedPassword = await hashPassword(password);

  const user = await createUser({
    fullName,
    email: normalizedEmail,
    phone: phone || "",
    password: hashedPassword,
    provider: "local",
    isVerified: false,
    hasPassword: true,
  });

  try {
    await sendEmail({
      to: user.email,
      subject: "Welcome 🎉",
      html: welcomeTemplate(user.fullName),
    });
  } catch (emailError) {
    console.error("❌ Failed to send welcome email:", emailError.message);
  }

  const { accessToken, refreshToken } = generateTokens(user, false);

  await updateLastLogin(user._id);
  await updateRefreshToken(user._id, refreshToken);

  const clientInfo = parseClientInfo(req);

  // Set HTTP-Only Cookie
  setAuthCookie(res, accessToken, false);

  await createSession({
    user: user._id,
    refreshToken,
    rememberMe: false,
    browser: clientInfo.browser,
    operatingSystem: clientInfo.operatingSystem,
    device: clientInfo.device,
    ipAddress: clientInfo.ipAddress,
    userAgent: clientInfo.userAgent,
    isCurrent: true,
    expiresAt: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
  });

  res.status(201).json({
    success: true,
    message: "Account created successfully.",
    token: accessToken,
    user: sanitizeUser(user),
  });
});

/* ==========================================================================
   4. Login
========================================================================== */
const login = asyncHandler(async (req, res) => {
  const { email, password, remember = false } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: "Email and password are required.",
    });
  }

  const normalizedEmail = email.toLowerCase().trim();
  let user = await findUserByEmail(normalizedEmail);

  if (!user) {
    const failCount = securityGatewayService.recordFailedLogin(normalizedEmail);
    const clientInfo = parseClientInfo(req);
    await securityGatewayService.logSecurityEvent({
      eventType: failCount >= 3 ? "BRUTE_FORCE_PATTERN" : "FAILED_LOGIN_ATTEMPT",
      severity: failCount >= 5 ? "CRITICAL" : (failCount >= 3 ? "HIGH" : "LOW"),
      requestId: clientInfo.requestId,
      ipAddress: clientInfo.ipAddress,
      userAgent: clientInfo.userAgent,
      browser: clientInfo.browser,
      operatingSystem: clientInfo.operatingSystem,
      device: clientInfo.device,
      endpoint: "/api/auth/login",
      httpMethod: "POST",
      httpStatus: 401,
      userEmail: normalizedEmail,
      actionTaken: failCount >= 5 ? "BLOCKED" : "MONITORED",
      reason: `Failed login attempt (unregistered account or wrong credentials): attempt #${failCount}`,
      riskScore: Math.min(100, failCount * 20),
      gatewayDecision: failCount >= 5 ? "CRITICAL" : (failCount >= 3 ? "HIGH_RISK" : "SUSPICIOUS"),
    });

    return res.status(401).json({
      success: false,
      message: "Invalid email or password.",
    });
  }

  const blockCheck = await securityGatewayService.checkUserBlocked(user);
  if (blockCheck.isBlocked) {
    return res.status(403).json({
      success: false,
      code: "USER_TEMPORARILY_BLOCKED",
      message: "Your account has been temporarily restricted due to suspicious activity.",
      blockedUntil: blockCheck.blockedUntil,
      remainingSeconds: blockCheck.remainingSeconds,
    });
  }

  if (!user.password) {
    return res.status(401).json({
      success: false,
      message: "Please sign in using Google or create a password.",
    });
  }

  const isMatch = await comparePassword(password, user.password);

  if (!isMatch) {
    const failCount = securityGatewayService.recordFailedLogin(normalizedEmail);
    const clientInfo = parseClientInfo(req);
    await securityGatewayService.logSecurityEvent({
      eventType: failCount >= 3 ? "BRUTE_FORCE_PATTERN" : "FAILED_LOGIN_ATTEMPT",
      severity: failCount >= 5 ? "CRITICAL" : (failCount >= 3 ? "HIGH" : "LOW"),
      requestId: clientInfo.requestId,
      ipAddress: clientInfo.ipAddress,
      userAgent: clientInfo.userAgent,
      browser: clientInfo.browser,
      operatingSystem: clientInfo.operatingSystem,
      device: clientInfo.device,
      endpoint: "/api/auth/login",
      httpMethod: "POST",
      httpStatus: 401,
      userId: user._id,
      userEmail: normalizedEmail,
      actionTaken: failCount >= 5 ? "BLOCKED" : "MONITORED",
      reason: `Incorrect password entered for account: attempt #${failCount}`,
      riskScore: Math.min(100, failCount * 20),
      gatewayDecision: failCount >= 5 ? "CRITICAL" : (failCount >= 3 ? "HIGH_RISK" : "SUSPICIOUS"),
    });

    if (failCount >= 3) {
      securityGatewayService.sendSecurityAlertEmailIfNeeded({
        userEmail: normalizedEmail,
        userName: user.fullName || "User",
        eventTitle: "Multiple Failed Login Attempts Detected",
        description: `Someone has repeatedly attempted (${failCount} times) to log in to your account with incorrect credentials.`,
        ipAddress: clientInfo.ipAddress,
        device: `${clientInfo.browser} on ${clientInfo.operatingSystem}`,
        actionTaken: failCount >= 5 ? "Temporarily Blocked by Gateway" : "Monitored & Rate-Limited",
        isBlocked: failCount >= 5,
        recommendation: "If this was not you, please change your password immediately to ensure account safety.",
      }).catch((err) => console.error("[SecurityGateway] Async email alert error:", err.message));
    }

    return res.status(401).json({
      success: false,
      message: "Invalid email or password.",
    });
  }

  // Reset failed login counter on successful authentication
  securityGatewayService.resetFailedLogins(normalizedEmail);

  const { accessToken, refreshToken } = generateTokens(user, remember);

  await updateLastLogin(user._id);
  await updateRefreshToken(user._id, refreshToken);

  const clientInfo = parseClientInfo(req);
  const sessionDays = remember ? 30 : 1;

  const session = await createSession({
    user: user._id,
    refreshToken,
    rememberMe: !!remember,
    browser: clientInfo.browser,
    operatingSystem: clientInfo.operatingSystem,
    device: clientInfo.device,
    ipAddress: clientInfo.ipAddress,
    userAgent: clientInfo.userAgent,
    isCurrent: true,
    expiresAt: new Date(Date.now() + sessionDays * 24 * 60 * 60 * 1000),
  });

  // Asynchronous login notification & security event logging
  sendNewLoginNotification({
    email: user.email,
    fullName: user.fullName,
    loginTime: new Date(),
    ipAddress: clientInfo.ipAddress,
    browser: clientInfo.browser,
    operatingSystem: clientInfo.operatingSystem,
    device: clientInfo.device,
    authMethod: "Email & Password",
    rememberMe: !!remember,
    requestId: clientInfo.requestId,
    sessionId: session?._id,
  }).catch((err) => console.error("[Security] Async login email notification error:", err.message));

  securityGatewayService.logSecurityEvent({
    eventType: "SUCCESSFUL_LOGIN",
    severity: "LOW",
    requestId: clientInfo.requestId,
    ipAddress: clientInfo.ipAddress,
    userAgent: clientInfo.userAgent,
    browser: clientInfo.browser,
    operatingSystem: clientInfo.operatingSystem,
    device: clientInfo.device,
    endpoint: "/api/auth/login",
    httpMethod: "POST",
    httpStatus: 200,
    userId: user._id,
    userEmail: user.email,
    actionTaken: "ALLOWED",
    reason: "User authenticated successfully via email and password credentials.",
    riskScore: 0,
    gatewayDecision: "NORMAL",
    metadata: { authMethod: "Email & Password", rememberMe: !!remember },
  }).catch((e) => console.error("[Security] Async login event log error:", e.message));

  // Set HTTP-Only Cookie
  setAuthCookie(res, accessToken, !!remember);

  res.status(200).json({
    success: true,
    message: "Login successful.",
    token: accessToken,
    user: sanitizeUser(user),
  });
});

/* ==========================================================================
   5. Google Login (Firebase Auth)
========================================================================== */
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

  if (!user && googleUser.email) {
    user = await findUserByEmail(googleUser.email.toLowerCase().trim());
    if (user && !user.googleId) {
      user.googleId = googleUser.uid;
      if (!user.profilePicture && googleUser.profilePicture) {
        user.profilePicture = googleUser.profilePicture;
      }
      await user.save();
    }
  }

  if (!user) {
    user = await createGoogleUser({
      fullName: googleUser.fullName,
      email: googleUser.email.toLowerCase().trim(),
      googleId: googleUser.uid,
      provider: "google",
      profilePicture: googleUser.profilePicture || "",
      isVerified: googleUser.emailVerified ?? true,
      password: "",
      hasPassword: false,
    });

    // Welcome Email
    try {
      await sendEmail({
        to: user.email,
        subject: "Welcome 🎉",
        html: welcomeTemplate(user.fullName),
      });
    } catch (emailError) {
      console.error("❌ Failed to send Google welcome email:", emailError.message);
    }
  }

  const blockCheck = await securityGatewayService.checkUserBlocked(user);
  if (blockCheck.isBlocked) {
    return res.status(403).json({
      success: false,
      code: "USER_TEMPORARILY_BLOCKED",
      message: "Your account has been temporarily restricted due to suspicious activity.",
      blockedUntil: blockCheck.blockedUntil,
      remainingSeconds: blockCheck.remainingSeconds,
    });
  }

  const { accessToken, refreshToken } = generateTokens(user, remember);

  // Update Last Login and Refresh Token in DB
  await updateLastLogin(user._id);
  await updateRefreshToken(user._id, refreshToken);

  const clientInfo = parseClientInfo(req);
  const sessionDays = remember ? 30 : 1;

  // Perform ALL session/database writes BEFORE sending the response
  const session = await createSession({
    user: user._id,
    refreshToken,
    rememberMe: !!remember,
    browser: clientInfo.browser,
    operatingSystem: clientInfo.operatingSystem,
    device: clientInfo.device,
    ipAddress: clientInfo.ipAddress,
    userAgent: clientInfo.userAgent,
    isCurrent: true,
    expiresAt: new Date(Date.now() + sessionDays * 24 * 60 * 60 * 1000),
  });

  // Asynchronous login notification & security event logging
  sendNewLoginNotification({
    email: user.email,
    fullName: user.fullName,
    loginTime: new Date(),
    ipAddress: clientInfo.ipAddress,
    browser: clientInfo.browser,
    operatingSystem: clientInfo.operatingSystem,
    device: clientInfo.device,
    authMethod: "Google",
    rememberMe: !!remember,
    requestId: clientInfo.requestId,
    sessionId: session?._id,
  }).catch((err) => console.error("[Security] Async Google login email notification error:", err.message));

  securityGatewayService.logSecurityEvent({
    eventType: "SUCCESSFUL_LOGIN",
    severity: "LOW",
    requestId: clientInfo.requestId,
    ipAddress: clientInfo.ipAddress,
    userAgent: clientInfo.userAgent,
    browser: clientInfo.browser,
    operatingSystem: clientInfo.operatingSystem,
    device: clientInfo.device,
    endpoint: "/api/auth/google",
    httpMethod: "POST",
    httpStatus: 200,
    userId: user._id,
    userEmail: user.email,
    actionTaken: "ALLOWED",
    reason: "User authenticated successfully via Google OAuth.",
    riskScore: 0,
    gatewayDecision: "NORMAL",
    metadata: { authMethod: "Google", rememberMe: !!remember },
  }).catch((e) => console.error("[Security] Async login event log error:", e.message));

  // Set HTTP-Only Cookie
  setAuthCookie(res, accessToken, !!remember);

  res.status(200).json({
    success: true,
    message: "Google Login successful.",
    token: accessToken,
    user: sanitizeUser(user),
  });
});

/* ==========================================================================
   6. Forgot Password (Sends OTP)
========================================================================== */
const forgotPassword = asyncHandler(async (req, res) => {
  const { email, type = "PASSWORD_RESET" } = req.body;

  if (!email) {
    return res.status(400).json({
      success: false,
      message: "Email is required.",
    });
  }

  const normalizedEmail = email.toLowerCase().trim();
  const user = await findUserByEmail(normalizedEmail);

  if (!user) {
    return res.status(404).json({
      success: false,
      message: "Email not registered.",
    });
  }

  // Remove previous OTPs of this type
  await deleteOTP(normalizedEmail, type);

  const otp = generateOTP();
  const hashedOTP = await hashOTP(otp);
  const otpExpireMinutes = Number(process.env.OTP_EXPIRE_MINUTES) || 10;

  await createOTP({
    user: user._id,
    email: user.email,
    phone: user.phone || "",
    otp: hashedOTP,
    type,
    deliveryMethod: "EMAIL",
    expiresAt: new Date(Date.now() + otpExpireMinutes * 60 * 1000),
  });

  try {
    await sendEmail({
      to: user.email,
      subject: "Password Reset OTP",
      html: otpTemplate(user.fullName, otp, otpExpireMinutes),
    });
  } catch (emailError) {
    console.error("❌ Failed to send reset OTP email:", emailError.message);
  }

  res.status(200).json({
    success: true,
    message: "OTP sent successfully.",
  });
});

/* ==========================================================================
   7. Verify OTP Controller
========================================================================== */
const verifyOTPController = asyncHandler(async (req, res) => {
  const { email, otp, type = "PASSWORD_RESET" } = req.body;

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
    const failOtpCount = securityGatewayService.recordFailedOTP(normalizedEmail);
    const clientInfo = parseClientInfo(req);

    await securityGatewayService.logSecurityEvent({
      eventType: "SUSPICIOUS_OTP_ATTEMPT",
      severity: failOtpCount >= 3 ? "HIGH" : "MEDIUM",
      ipAddress: clientInfo.ipAddress,
      userAgent: clientInfo.userAgent,
      endpoint: "/api/auth/verify-otp",
      httpMethod: "POST",
      userEmail: normalizedEmail,
      actionTaken: "MONITORED",
      reason: `Invalid OTP submission for type=${type}: attempt #${failOtpCount}`,
      riskScore: Math.min(100, failOtpCount * 25),
      gatewayDecision: failOtpCount >= 3 ? "HIGH_RISK" : "SUSPICIOUS",
    });

    if (failOtpCount >= 3) {
      securityGatewayService.sendSecurityAlertEmailIfNeeded({
        userEmail: normalizedEmail,
        eventTitle: "Multiple Invalid OTP Attempts Detected",
        description: `Multiple incorrect one-time verification codes (${failOtpCount} attempts) were submitted for your account.`,
        ipAddress: clientInfo.ipAddress,
        device: `${clientInfo.browser} on ${clientInfo.operatingSystem}`,
        actionTaken: "Monitored & Logged",
        isBlocked: false,
        recommendation: "If you did not initiate this request, please ensure your email account is secure.",
      }).catch((err) => console.error("[SecurityGateway] Async email error:", err.message));
    }

    return res.status(400).json({
      success: false,
      message: "Invalid OTP.",
    });
  }

  // Reset failed OTP attempts on successful verification
  securityGatewayService.resetFailedOTPs(normalizedEmail);
  await verifyOTP(otpRecord._id);

  res.status(200).json({
    success: true,
    message: "OTP verified successfully.",
  });
});

/* ==========================================================================
   8. Reset Password
========================================================================== */
const resetPassword = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: "Email and new password are required.",
    });
  }

  const normalizedEmail = email.toLowerCase().trim();
  const otpRecord =
    (await findVerifiedOTPByType(normalizedEmail, "PASSWORD_RESET")) ||
    (await findVerifiedOTP(normalizedEmail));

  if (!otpRecord) {
    return res.status(400).json({
      success: false,
      message: "OTP verification required.",
    });
  }

  const user = await findUserByEmail(normalizedEmail);

  if (!user) {
    return res.status(404).json({
      success: false,
      message: "User not found.",
    });
  }

  const hashedPassword = await hashPassword(password);
  user.password = hashedPassword;
  user.hasPassword = true;
  await user.save();

  // Invalidate all previous sessions on password reset for security
  await revokeAllSessions(user._id);

  // Clean up used OTP
  await deleteOTP(normalizedEmail, "PASSWORD_RESET");

  const clientInfo = parseClientInfo(req);
  await securityGatewayService.logSecurityEvent({
    eventType: "PASSWORD_RESET_SUCCESS",
    severity: "LOW",
    ipAddress: clientInfo.ipAddress,
    userAgent: clientInfo.userAgent,
    endpoint: "/api/auth/reset-password",
    httpMethod: "POST",
    userId: user._id,
    userEmail: normalizedEmail,
    actionTaken: "ALLOWED",
    reason: "Password reset completed successfully. All active sessions invalidated.",
    riskScore: 0,
    gatewayDecision: "NORMAL",
  });

  res.status(200).json({
    success: true,
    message: "Password reset successfully.",
  });
});

/* ==========================================================================
   9. Logout
========================================================================== */
const logout = asyncHandler(async (req, res) => {
  if (req.user?._id) {
    await revokeCurrentSession(req.user._id);
  }

  const isProduction =
    process.env.NODE_ENV === "production" &&
    !process.env.CLIENT_URL?.includes("localhost") &&
    !process.env.FRONTEND_URL?.includes("localhost");

  res.clearCookie("token", {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    path: "/",
  });

  res.status(200).json({
    success: true,
    message: "Logout successful.",
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