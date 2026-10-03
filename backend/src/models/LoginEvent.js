const mongoose = require("mongoose");

const loginEventSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    userEmail: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    eventType: {
      type: String,
      enum: [
        "LOCAL_LOGIN_SUCCESS",
        "GOOGLE_LOGIN_SUCCESS",
        "LOGIN_FAILED",
        "NEW_DEVICE_DETECTED",
        "UNUSUAL_LOCATION_DETECTED",
        "HIGH_RISK_LOGIN",
        "REPEATED_LOGIN_FAILURES",
        "STEP_UP_CHALLENGED",
        "PASSWORD_RESET_LOGIN",
      ],
      required: true,
      index: true,
    },
    provider: {
      type: String,
      enum: ["local", "google", "unknown"],
      default: "local",
      index: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
    ipAddress: {
      type: String,
      default: "127.0.0.1",
      index: true,
    },
    clientIdentifier: {
      type: String,
      default: "",
      index: true,
    },
    deviceId: {
      type: String,
      default: "",
      index: true,
    },
    userAgent: {
      type: String,
      default: "",
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
    location: {
      country: { type: String, default: "Unknown Country" },
      region: { type: String, default: "" },
      city: { type: String, default: "Unknown City" },
      latitude: { type: Number, default: null },
      longitude: { type: Number, default: null },
      isPrivate: { type: Boolean, default: false },
    },
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Session",
      default: null,
      index: true,
    },
    riskScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
      index: true,
    },
    riskLevel: {
      type: String,
      enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
      default: "LOW",
      index: true,
    },
    riskReasons: {
      type: [String],
      default: [],
    },
    status: {
      type: String,
      enum: ["SUCCESS", "FAILED", "BLOCKED", "CHALLENGED"],
      default: "SUCCESS",
      index: true,
    },
    notificationStatus: {
      type: String,
      enum: ["NONE", "SENT", "SKIPPED", "FAILED", "SUPPRESSED"],
      default: "NONE",
    },
    userReviewStatus: {
      type: String,
      enum: ["PENDING", "RECOGNIZED", "SUSPICIOUS"],
      default: "PENDING",
      index: true,
    },
    investigationStatus: {
      type: String,
      enum: ["NORMAL", "UNDER_INVESTIGATION", "RESOLVED", "FALSE_POSITIVE"],
      default: "NORMAL",
      index: true,
    },
    investigationNotes: {
      type: String,
      default: "",
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

loginEventSchema.index({ userId: 1, timestamp: -1 });
loginEventSchema.index({ userEmail: 1, timestamp: -1 });
loginEventSchema.index({ riskLevel: 1, timestamp: -1 });
loginEventSchema.index({ investigationStatus: 1, timestamp: -1 });

module.exports = mongoose.model("LoginEvent", loginEventSchema);
