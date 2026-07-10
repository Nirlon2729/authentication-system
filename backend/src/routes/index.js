const express = require("express");

const router = express.Router();

const authRoutes = require("./authRoutes");
const profileRoutes = require("./profileRoutes");

router.use("/auth", authRoutes);

router.use("/profile", profileRoutes);

router.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Authentication API v1",
  });
});

module.exports = router;