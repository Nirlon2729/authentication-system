const User = require("../models/User");
const updateGoogleUser = async (userId, data) => {
  return await User.findByIdAndUpdate(
    userId,
    {
      fullName: data.fullName,
      profilePicture: data.profilePicture,
      isVerified: data.emailVerified,
      lastLogin: new Date(),
    },
    {
      returnDocument: "after",
    }
  );
};
const createUser = async (userData) => {
  return await User.create(userData);
};
const findUserByGoogleId = async (googleId) => {
  return await User.findOne({
    googleId,
  });
};
const createGoogleUser = async (userData) => {
  const user = new User(userData);

  return await user.save();
};
const findUserByEmail = async (email) => {
  return await User.findOne({ email });
};
const updateLastLogin = async (userId) => {
  return await User.findByIdAndUpdate(
    userId,
    {
      lastLogin: new Date(),
    },
    {
      returnDocument: "after",
    }
  );
};

const updateRefreshToken = async (userId, refreshToken) => {
  return await User.findByIdAndUpdate(
    userId,
    {
      refreshToken,
    },
    {
      returnDocument: "after",
    }
  );
};

const updateUserEmail = async (
  userId,
  email
) => {
  return await User.findByIdAndUpdate(
    userId,
    {
      email,
    },
    {
      returnDocument: "after",
    }
  );
};
module.exports = {
  createUser,
  createGoogleUser,
  findUserByEmail,
  findUserByGoogleId,
  updateGoogleUser,
  updateLastLogin,
  updateRefreshToken,
  updateUserEmail,
};