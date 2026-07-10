const mongoose = require("mongoose");

const sessionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    refreshToken: {
      type: String,
      required: true,
    },

    device: {
      type: String,
      default: "Unknown Device",
    },

    browser: {
      type: String,
      default: "Unknown Browser",
    },

    operatingSystem: {
      type: String,
      default: "Unknown OS",
    },

    ipAddress: {
      type: String,
      default: "",
    },

    location: {
      type: String,
      default: "",
    },

    userAgent: {
      type: String,
      default: "",
    },

    rememberMe: {
      type: Boolean,
      default: false,
    },

    isCurrent: {
      type: Boolean,
      default: false,
    },

    isRevoked: {
      type: Boolean,
      default: false,
    },

    expiresAt: {
      type: Date,
      required: true,
    },

    lastActive: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

sessionSchema.index(
  {
    expiresAt: 1,
  },
  {
    expireAfterSeconds: 0,
  }
);

module.exports = mongoose.model(
  "Session",
  sessionSchema
);