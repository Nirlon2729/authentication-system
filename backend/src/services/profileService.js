const User = require("../models/User");

const updateProfile = async (userId, data) => {
  return await User.findByIdAndUpdate(
    userId,
    data,
    {
      new: true,
      runValidators: true,
    }
  ).select("-password");
};

const deleteProfile = async (userId) => {
  return await User.findByIdAndDelete(userId);
};

const changePassword = async (
  userId,
  hashedPassword
) => {
  return await User.findByIdAndUpdate(
    userId,
    {
      password: hashedPassword,
    },
    {
      new: true,
    }
  );
};

module.exports = {
  updateProfile,
  deleteProfile,
  changePassword,
};