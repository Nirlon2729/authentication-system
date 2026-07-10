const express = require("express");

const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");

const upload = require("../middleware/uploadMiddleware");


const {
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
} = require("../controllers/profileController");


router.get(
  "/",
  authMiddleware,
  getProfile
);

router.put(
  "/",
  authMiddleware,
  updateUserProfile
);
router.patch(
  "/avatar",
  authMiddleware,
  upload.single("avatar"),
  uploadProfilePicture
);
router.delete(
  "/",
  authMiddleware,
  deleteAccount
);
router.patch(
  "/change-password",
  authMiddleware,
  changeUserPassword
);
router.post(
  "/create-password/request",
  authMiddleware,
  requestCreatePasswordOTP
);

router.patch(
  "/create-password",
  authMiddleware,
  createPassword
);
router.get(
  "/sessions",
  authMiddleware,
  getUserSessions
);
router.delete(
  "/sessions/:sessionId",
  authMiddleware,
  logoutSession
);
router.post(
  "/change-email/request",
  authMiddleware,
  requestEmailChangeOTP
);
router.patch(
  "/change-email",
  authMiddleware,
  verifyEmailChangeOTP
);
module.exports = router;