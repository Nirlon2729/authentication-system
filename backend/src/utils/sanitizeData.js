const sanitizeUser = (user) => {
  return {
    id: user._id,
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
    profilePicture: user.profilePicture,
    provider: user.provider,
    hasPassword: user.hasPassword,
    role: user.role,
    isVerified: user.isVerified,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
};

module.exports = sanitizeUser;