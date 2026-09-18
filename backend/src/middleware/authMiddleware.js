const jwt = require("jsonwebtoken");
const User = require("../models/User");
const securityGatewayService = require("../services/securityGatewayService");

const authMiddleware = async (req, res, next) => {
  try {
    if (!process.env.JWT_SECRET) {
      console.error("❌ JWT_SECRET environment variable is missing.");
      return res.status(500).json({
        success: false,
        message: "Internal server error: auth configuration missing.",
      });
    }

    let token = null;

    // 1. Authorization Header
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }

    // 2. Cookie fallback
    if (!token && req.cookies?.token) {
      token = req.cookies.token;
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Access denied. Token not provided.",
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      if (err.name === "TokenExpiredError") {
        return res.status(401).json({
          success: false,
          message: "Token expired. Please login again.",
        });
      }
      return res.status(401).json({
        success: false,
        message: "Invalid token.",
      });
    }

    if (!decoded || !decoded.id) {
      return res.status(401).json({
        success: false,
        message: "Invalid token payload.",
      });
    }

    const user = await User.findById(decoded.id).select("-password");

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found.",
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

    req.user = user;
    next();
  } catch (error) {
    console.error("Auth middleware error:", error.message);
    return res.status(401).json({
      success: false,
      message: "Authentication failed.",
    });
  }
};

module.exports = authMiddleware;