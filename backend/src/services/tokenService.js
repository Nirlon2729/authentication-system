const generateAccessToken = require("../utils/generateAccessToken");
const generateRefreshToken = require("../utils/generateRefreshToken");

const generateTokens = (user, rememberMe = false) => {
  const payload = {
    id: user._id,
    email: user.email,
    role: user.role,
    provider: user.provider,
  };

  const accessToken =
    generateAccessToken(payload);

  const refreshToken =
    generateRefreshToken(
      payload,
      rememberMe
    );

  return {
    accessToken,
    refreshToken,
  };
};

module.exports = {
  generateTokens,
};