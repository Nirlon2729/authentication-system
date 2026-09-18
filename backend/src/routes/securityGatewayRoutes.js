const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const { adminLimiter, securityTestLimiter } = require("../middleware/rateLimiter");

const {
  getStats,
  getEvents,
  getLiveFeed,
  getTrafficTimeline,
  getThreatAnalytics,
  getBlockedClients,
  unblockClient,
  exportCSV,
  getSystemStatus,
  handleTestTraffic,
  startSimulation,
  stopSimulation,
  getWebsiteLockdownStatus,
  enableWebsiteLockdown,
  restoreWebsite,
  getBlockedUsers,
  unblockUser,
  blockUser,
} = require("../controllers/securityGatewayController");

// Dedicated internal test endpoint for Security Test Lab
// Evaluates individual synthetic test requests under verified simulation context
router.post(
  "/test-traffic",
  authMiddleware,
  roleMiddleware("admin"),
  securityTestLimiter,
  handleTestTraffic
);

// Super Admin Emergency Controls (Strictly requires SUPER_ADMIN role)
router.get(
  "/super-admin/website-status",
  authMiddleware,
  roleMiddleware("super_admin"),
  adminLimiter,
  getWebsiteLockdownStatus
);
router.post(
  "/super-admin/website/lockdown",
  authMiddleware,
  roleMiddleware("super_admin"),
  adminLimiter,
  enableWebsiteLockdown
);
router.post(
  "/super-admin/website/restore",
  authMiddleware,
  roleMiddleware("super_admin"),
  adminLimiter,
  restoreWebsite
);

// Admin SOC Dashboard APIs (Require authentication + Admin role)
router.use("/admin", authMiddleware, roleMiddleware("admin"), adminLimiter);

router.get("/admin/stats", getStats);
router.get("/admin/events", getEvents);
router.get("/admin/feed", getLiveFeed);
router.get("/admin/traffic", getTrafficTimeline);
router.get("/admin/threats", getThreatAnalytics);
router.get("/admin/blocked", getBlockedClients);
router.post("/admin/unblock/:clientId", unblockClient);
router.get("/admin/export", exportCSV);
router.get("/admin/status", getSystemStatus);
router.post("/admin/test/start", startSimulation);
router.post("/admin/test/run", startSimulation); // backwards compatible alias
router.post("/admin/test/stop", stopSimulation);

// Blocked Users Management APIs (Admin & Super Admin)
router.get("/admin/blocked-users", getBlockedUsers);
router.post("/admin/unblock-user/:userId", unblockUser);
router.post("/admin/block-user/:userId", blockUser);

module.exports = router;
