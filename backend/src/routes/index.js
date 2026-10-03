const express = require("express");
const mongoose = require("mongoose");

const router = express.Router();

const authRoutes = require("./authRoutes");
const profileRoutes = require("./profileRoutes");
const userRoutes = require("./userRoutes");
const otpRoutes = require("./otpRoutes");
const securityGatewayRoutes = require("./securityGatewayRoutes");

router.use("/auth", authRoutes);
router.use("/profile", profileRoutes);
router.use("/users", userRoutes);
router.use("/otp", otpRoutes);
router.use("/security", securityGatewayRoutes);

router.get("/health", (req, res) => {
  const dbConnected = mongoose.connection.readyState === 1;
  const emailConfigured = Boolean(
    process.env.SMTP_USER ||
    process.env.EMAIL_USER ||
    process.env.SENDGRID_API_KEY ||
    process.env.RESEND_API_KEY
  );

  res.status(200).json({
    success: true,
    status: dbConnected ? "healthy" : "degraded",
    environment: process.env.NODE_ENV || "development",
    timestamp: new Date().toISOString(),
    services: {
      database: dbConnected ? "connected" : "disconnected",
      securityGateway: "operational",
      email: emailConfigured ? "configured" : "ready",
    },
  });
});

router.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Authentication API v1 with AI Security Gateway",
  });
});

module.exports = router;