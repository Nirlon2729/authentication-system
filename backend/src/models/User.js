const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 100,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    phone: {
      type: String,
      default: "",
      trim: true,
    },

    password: {
      type: String,
      default: "",
    },

    hasPassword: {
      type: Boolean,
      default: true,
    },

    profilePicture: {
      type: String,
      default: "",
    },

    provider: {
      type: String,
      enum: ["local", "google"],
      default: "local",
    },

    role: {
      type: String,
      enum: ["user", "admin", "super_admin"],
      default: "user",
    },

    isVerified: {
      type: Boolean,
      default: false,
    },

    isBlocked: {
      type: Boolean,
      default: false,
      index: true,
    },

    blockedUntil: {
      type: Date,
      default: null,
      index: true,
    },

    blockReason: {
      type: String,
      default: "",
    },

    blockSource: {
      type: String,
      enum: ["AI_SECURITY_GATEWAY", "ADMIN_MANUAL", "SYSTEM", null],
      default: null,
    },

    blockedAt: {
      type: Date,
      default: null,
    },

    blockedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    lastLogin: {
      type: Date,
      default: null,
    },

    refreshToken: {
      type: String,
      default: "",
    },
    googleId: {
      type: String,
      default: "",
    },

    isSecurityTestAccount: {
      type: Boolean,
      default: false,
      index: true,
    },

    simulationId: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

userSchema.index({ isBlocked: 1, blockedUntil: 1 });

module.exports = mongoose.model("User", userSchema);