const User = require("../models/User");
const Session = require("../models/Session");
const LoginHistory = require("../models/LoginHistory");
const cloudinary = require("../config/cloudinary");
const { deleteOTPByUser } = require("./otpService");

const deleteAccountService = async (user) => {
  const userId = user._id || user.id;

  // Delete OTPs
  await deleteOTPByUser(userId);

  // Delete all sessions
  await Session.deleteMany({ user: userId });

  // Delete login history
  await LoginHistory.deleteMany({ userId });

  // Delete Cloudinary profile picture
  if (
    user.profilePicture &&
    user.profilePicture.includes("res.cloudinary.com")
  ) {
    try {
      const uploadIndex = user.profilePicture.indexOf("/upload/");

      if (uploadIndex !== -1) {
        let publicId = user.profilePicture.substring(uploadIndex + 8);

        // Remove version (v123456...)
        publicId = publicId.replace(/^v\d+\//, "");

        // Remove extension
        publicId = publicId.replace(/\.[^/.]+$/, "");

        await cloudinary.uploader.destroy(publicId);
      }
    } catch (error) {
      console.error(
        "Failed to delete Cloudinary image:",
        error.message
      );
    }
  }

  // Delete user
  await User.findByIdAndDelete(userId);
};

module.exports = {
  deleteAccountService,
};