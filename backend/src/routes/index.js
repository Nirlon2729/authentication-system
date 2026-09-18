const express = require("express");

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

router.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Authentication API v1 with AI Security Gateway",
  });
});

module.exports = router;