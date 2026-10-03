const mongoose = require("mongoose");

const recognizedDeviceSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    deviceId: {
      type: String,
      required: true,
      index: true,
    },
    deviceFingerprint: {
      type: String,
      default: "",
      index: true,
    },
    browser: {
      type: String,
      default: "Unknown Browser",
    },
    operatingSystem: {
      type: String,
      default: "Unknown OS",
    },
    device: {
      type: String,
      default: "Desktop",
    },
    userAgent: {
      type: String,
      default: "",
    },
    firstSeenAt: {
      type: Date,
      default: Date.now,
    },
    lastSeenAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    lastIp: {
      type: String,
      default: "",
    },
    lastLocation: {
      country: { type: String, default: "Unknown Country" },
      city: { type: String, default: "Unknown City" },
    },
    isRevoked: {
      type: Boolean,
      default: false,
      index: true,
    },
    trustLevel: {
      type: String,
      enum: ["TRUSTED", "PROVISIONAL", "REVOKED"],
      default: "TRUSTED",
    },
  },
  {
    timestamps: true,
  }
);

recognizedDeviceSchema.index({ userId: 1, deviceId: 1 }, { unique: true });
recognizedDeviceSchema.index({ userId: 1, isRevoked: 1 });

module.exports = mongoose.model("RecognizedDevice", recognizedDeviceSchema);
