const mongoose = require("mongoose");
const { LOCKDOWN_MODES } = require("../constants/securityEvents");

const systemLockdownSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      default: "GLOBAL_LOCKDOWN",
      unique: true,
      required: true,
    },
    enabled: {
      type: Boolean,
      default: false,
    },
    mode: {
      type: String,
      enum: [LOCKDOWN_MODES.ONLINE, LOCKDOWN_MODES.LOCKDOWN],
      default: LOCKDOWN_MODES.ONLINE,
    },
    reason: {
      type: String,
      default: "",
      trim: true,
    },
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    changedByEmail: {
      type: String,
      default: "",
    },
    changedAt: {
      type: Date,
      default: Date.now,
    },
    expiresAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("SystemLockdown", systemLockdownSchema);
