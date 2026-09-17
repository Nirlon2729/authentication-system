const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

const {
  getAllUsers,
  requestCreateAdminOTP,
  confirmCreateAdminOTP,
  updateUserRole,
  toggleUserBlock,
  deleteUser,
  getAdminAnalytics,
} = require("../controllers/userController");

// All routes require authentication & admin role
router.use(authMiddleware);
router.use(roleMiddleware("admin"));

router.get("/", getAllUsers);
router.post("/admin/request-otp", requestCreateAdminOTP);
router.post("/admin/confirm-otp", confirmCreateAdminOTP);
router.get("/analytics", getAdminAnalytics);
router.patch("/:userId/role", updateUserRole);
router.patch("/:userId/block", toggleUserBlock);
router.delete("/:userId", deleteUser);

module.exports = router;
