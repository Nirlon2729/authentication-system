const OTP = require("../models/OTP");

const createOTP = async (data) => {
  return await OTP.create(data);
};

const findOTP = async (email, otp) => {
  return await OTP.findOne({
    email,
    otp,
    verified: false,
  });
};

const verifyOTP = async (id) => {
  return await OTP.findByIdAndUpdate(
    id,
    {
      verified: true,
    },
    {
      new: true,
    }
  );
};

const deleteOTP = async (email) => {
  return await OTP.deleteMany({
    email,
  });
};
const findOTPByEmail = async (email) => {
  return await OTP.findOne({
    email,
    verified: false,
  });
};
const findOTPByEmailAndType = async (
  email,
  type
) => {
  return await OTP.findOne({
    email,
    type,
    verified: false,
  });
};
const incrementAttempts = async (id) => {
  return await OTP.findByIdAndUpdate(
    id,
    {
      $inc: {
        attempts: 1,
      },
    },
    {
      new: true,
    }
  );
};
const findVerifiedOTPByType = async (
  email,
  type
) => {
  return await OTP.findOne({
    email,
    type,
    verified: true,
  });
};
const findVerifiedOTP = async (email) => {
  return await OTP.findOne({
    email,
    verified: true,
  });
};
const deleteOTPByUser = async (userId) => {
  return await OTP.deleteMany({
    user: userId,
  });
};

module.exports = {
  createOTP,
  deleteOTP,
  findOTP,
  findOTPByEmail,
  findOTPByEmailAndType,
  verifyOTP,
  incrementAttempts,
  findVerifiedOTP,
  findVerifiedOTPByType,
  deleteOTPByUser,
};