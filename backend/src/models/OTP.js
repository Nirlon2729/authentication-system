const mongoose = require("mongoose");

const otpSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    email: {
      type: String,
      required: true,
    },

    phone: {
      type: String,
      default: "",
    },
    signupData: {
      fullName: {
        type: String,
        default: "",
      },

      phone: {
        type: String,
        default: "",
      },

      password: {
        type: String,
        default: "",
      },
    },
    otp: {
      type: String,
      required: true,
    },

    type: {
      type: String,
      enum: [
        "EMAIL_VERIFICATION",
        "PASSWORD_RESET",
        "CREATE_PASSWORD",
        "SIGNUP",
        "CHANGE_EMAIL",
      ],
      required: true,
    },

    deliveryMethod: {
      type: String,
      enum: ["EMAIL", "SMS"],
      default: "EMAIL",
    },

    expiresAt: {
      type: Date,
      required: true,
    },

    attempts: {
      type: Number,
      default: 0,
    },

    verified: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

otpSchema.index(
  {
    expiresAt: 1,
  },
  {
    expireAfterSeconds: 0,
  }
);

module.exports = mongoose.model("OTP", otpSchema);