const mongoose = require("mongoose");

const securityEventSchema = new mongoose.Schema(
  {
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
    requestId: {
      type: String,
      default: "",
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
    browser: {
      type: String,
      default: "",
    },
    operatingSystem: {
      type: String,
      default: "",
    },
    device: {
      type: String,
      default: "",
    },
    endpoint: {
      type: String,
      required: true,
      index: true,
    },
    httpMethod: {
      type: String,
      default: "POST",
    },
    httpStatus: {
      type: Number,
      default: 200,
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
      enum: ["ALLOWED", "MONITORED", "RATE_LIMITED", "CHALLENGED", "BLOCKED", "ALERTED"],
      default: "ALLOWED",
      index: true,
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
      index: true,
    },
    gatewayDecision: {
      type: String,
      enum: ["NORMAL", "SUSPICIOUS", "HIGH_RISK", "CRITICAL", "BLOCKED"],
      default: "NORMAL",
      index: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    isSimulation: {
      type: Boolean,
      default: false,
      index: true,
    },
    simulationId: {
      type: String,
      default: null,
      index: true,
    },
    testAccountId: {
      type: String,
      default: null,
    },
    clientType: {
      type: String,
      enum: ["REAL", "SIMULATION"],
      default: "REAL",
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

securityEventSchema.index({ timestamp: -1, isSimulation: 1 });

module.exports = mongoose.model("SecurityEvent", securityEventSchema);
