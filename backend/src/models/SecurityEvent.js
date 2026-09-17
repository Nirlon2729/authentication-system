const mongoose = require("mongoose");

const securityEventSchema = new mongoose.Schema(
  {
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
    eventType: {
      type: String,
      required: true,
      index: true,
    },
    severity: {
      type: String,
      enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
      default: "LOW",
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
    userAgent: {
      type: String,
      default: "",
    },
    endpoint: {
      type: String,
      required: true,
    },
    httpMethod: {
      type: String,
      default: "POST",
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    userEmail: {
      type: String,
      default: "",
      lowercase: true,
      trim: true,
      index: true,
    },
    actionTaken: {
      type: String,
      enum: ["ALLOWED", "MONITORED", "RATE_LIMITED", "BLOCKED", "ALERTED"],
      default: "ALLOWED",
    },
    reason: {
      type: String,
      default: "",
    },
    riskScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    gatewayDecision: {
      type: String,
      enum: ["NORMAL", "SUSPICIOUS", "HIGH_RISK", "CRITICAL", "BLOCKED"],
      default: "NORMAL",
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

module.exports = mongoose.model("SecurityEvent", securityEventSchema);
