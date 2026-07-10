const bcrypt = require("bcrypt");

const compareOTP = async (otp, hashedOTP) => {
  return await bcrypt.compare(otp, hashedOTP);
};

module.exports = compareOTP;