const jwt = require("jsonwebtoken");

const generateRefreshToken = (
  payload,
  rememberMe = false
) => {
  return jwt.sign(
    payload,
    process.env.JWT_REFRESH_SECRET,
    {
      expiresIn: rememberMe
        ? "30d"
        : "1d",
    }
  );
};

module.exports =  generateRefreshToken;