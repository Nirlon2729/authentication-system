const nodemailer = require("nodemailer");

const port = Number(process.env.EMAIL_PORT) || 587;
const secure = process.env.EMAIL_SECURE !== undefined
  ? process.env.EMAIL_SECURE === "true"
  : port === 465;

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || "smtp.gmail.com",
  port,
  secure,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  // Strict timeout configuration to prevent hung requests when SMTP ports are blocked (e.g. Render Free tier)
  connectionTimeout: 5000,
  greetingTimeout: 5000,
  socketTimeout: 8000,
});

// Safe diagnostic logging function (never logs passwords or secrets)
const logEmailDiagnostics = () => {
  console.log("📬 [EmailConfig Diagnostics]");
  console.log("  - BREVO_API_KEY set:", Boolean(process.env.BREVO_API_KEY));
  console.log("  - RESEND_API_KEY set:", Boolean(process.env.RESEND_API_KEY));
  console.log("  - EMAIL_HOST:", process.env.EMAIL_HOST || "(not set, default smtp.gmail.com)");
  console.log("  - EMAIL_PORT:", port);
  console.log("  - EMAIL_SECURE:", secure);
  console.log("  - EMAIL_USER set:", Boolean(process.env.EMAIL_USER));
  console.log("  - EMAIL_PASS set:", Boolean(process.env.EMAIL_PASS));
};

if (process.env.NODE_ENV !== "test") {
  logEmailDiagnostics();
  transporter.verify((error) => {
    if (error) {
      console.warn("⚠️ SMTP Verification warning (outbound SMTP ports may be blocked on free tier hosts like Render):", error.message);
      console.warn("💡 Tip: Set BREVO_API_KEY or RESEND_API_KEY in environment variables to deliver emails via HTTPS (port 443).");
    } else {
      console.log("✅ SMTP Connected Successfully");
    }
  });
}

module.exports = transporter;
module.exports.logEmailDiagnostics = logEmailDiagnostics;