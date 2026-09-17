const jwt = require("jsonwebtoken");
const generateAccessToken = require("../utils/generateAccessToken");
const generateRefreshToken = require("../utils/generateRefreshToken");

const generateTokens = (user, rememberMe = false) => {
  const payload = {
    id: user._id,
    email: user.email,
    role: user.role,
    provider: user.provider,
  };

  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload, rememberMe);

  return {
    accessToken,
    refreshToken,
  };
};

const verifyAccessToken = (token) => {
  return jwt.verify(token, process.env.JWT_SECRET);
};

const verifyRefreshToken = (token) => {
  const secret =
    process.env.REFRESH_TOKEN_SECRET ||
    process.env.JWT_REFRESH_SECRET ||
    process.env.JWT_SECRET;
  return jwt.verify(token, secret);
};

module.exports = {
  generateTokens,
  verifyAccessToken,
  verifyRefreshToken,
};