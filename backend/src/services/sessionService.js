const Session = require("../models/Session");



const createSession = async (sessionData) => {
  // Make previous sessions non-current
  await Session.updateMany(
    {
      user: sessionData.user,
    },
    {
      isCurrent: false,
    }
  );

  return await Session.create(sessionData);
};

const findSessionByRefreshToken = async (
  refreshToken
) => {
  return await Session.findOne({
    refreshToken,
    isRevoked: false,
  }).populate("user");
};

const findUserSessions = async (userId) => {
  return await Session.find({
    user: userId,
    isRevoked: false,
  })
    .select(
      "-refreshToken -userAgent -__v"
    )
    .sort({
      lastActive: -1,
    });
};

const updateLastActive = async (
  sessionId
) => {
  return await Session.findByIdAndUpdate(
    sessionId,
    {
      lastActive: new Date(),
    },
    {
      new: true,
    }
  );
};

const revokeSession = async (
  sessionId
) => {
  return await Session.findByIdAndUpdate(
    sessionId,
    {
      isRevoked: true,
    },
    {
      new: true,
    }
  );
};

const revokeAllSessions = async (
  userId
) => {
  return await Session.updateMany(
    {
      user: userId,
    },
    {
      isRevoked: true,
    }
  );
};

module.exports = {
  createSession,
  findSessionByRefreshToken,
  findUserSessions,
  updateLastActive,
  revokeSession,
  revokeAllSessions,
};