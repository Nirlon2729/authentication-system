const User = require("../models/User");
const cloudinary = require("../config/cloudinary");
const { deleteOTPByUser } = require("./otpService");

const deleteAccountService = async (user) => {
  // Delete OTPs
  await deleteOTPByUser(user._id);

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
  await User.findByIdAndDelete(user._id);
};
module.exports = {
  deleteAccountService,
};