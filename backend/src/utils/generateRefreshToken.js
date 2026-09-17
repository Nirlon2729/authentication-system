const jwt = require("jsonwebtoken");

const generateRefreshToken = (payload, rememberMe = false) => {
  const secret =
    process.env.REFRESH_TOKEN_SECRET ||
    process.env.JWT_REFRESH_SECRET ||
    process.env.JWT_SECRET;

  const expiresIn = rememberMe
    ? process.env.REFRESH_TOKEN_EXPIRES_IN || "30d"
    : "1d";

  return jwt.sign(payload, secret, {
    expiresIn,
  });
};

module.exports = generateRefreshToken;
