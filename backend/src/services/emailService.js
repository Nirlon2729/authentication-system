const transporter = require("../config/mail");
const newLoginTemplate = require("../templates/email/newLoginTemplate");

const isSuppressedRecipient = (email) => {
  if (!email || typeof email !== "string") return true;
  const normalized = email.toLowerCase().trim();
  return (
    normalized.endsWith(".invalid") ||
    normalized.includes("example.invalid") ||
    normalized.startsWith("security-test") ||
    normalized.includes("security-test-") ||
    normalized === "test@example.com" ||
    normalized === "testuser@gmail.com"
  );
};

const sendEmail = async ({ to, subject, html }) => {
  if (!to) {
    return { suppressed: true, message: "No recipient specified." };
  }

  // Strict simulation safety check: NEVER send real emails to synthetic or test accounts
  if (isSuppressedRecipient(to)) {
    console.log(`🛡️ [EmailSafety] Suppressed outbound email to simulation/test address: ${to}`);
    return { suppressed: true, reason: "Simulation email suppressed", to };
  }

  // If in test environment without explicit opt-in, safely mock delivery
  if (process.env.NODE_ENV === "test" && process.env.ENABLE_TEST_EMAILS !== "true") {
    console.log(`🧪 [TestMode] Mocked email delivery to ${to}`);
    return { success: true, mocked: true, to, messageId: `test-${Date.now()}` };
  }

  // If Brevo API key is available, send email via Brevo HTTPS API to bypass SMTP block
  if (process.env.BREVO_API_KEY) {
    try {
      console.log("📨 Sending email via Brevo HTTPS API...");
      const response = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          accept: "application/json",
          "api-key": process.env.BREVO_API_KEY,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          sender: {
            name: "Security Center",
            email: process.env.EMAIL_USER || "no-reply@security.com",
          },
          to: [{ email: to }],
          subject: subject,
          htmlContent: html,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || `Brevo API returned status code ${response.status}`);
      }

      console.log("✅ Email sent successfully via Brevo HTTPS API:", data.messageId);
      return data;
    } catch (error) {
      console.error("❌ Deployed Brevo HTTPS API email sending failed:", error.message);
      throw error;
    }
  }

  // Fallback to Nodemailer SMTP
  try {
    const info = await transporter.sendMail({
      from: `"Authentication System" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
    });

    console.log("✅ Email sent:", info.response);

    return info;
  } catch (error) {
    console.error("❌ Email failed:", error.message);
    throw error;
  }
};

/**
 * Dispatches a new login security notification email asynchronously.
 * Guarantees that any delivery failure will be logged safely without affecting auth.
 */
const sendNewLoginNotification = async ({
  email,
  fullName,
  loginTime,
  ipAddress,
  browser,
  operatingSystem,
  device,
  authMethod,
  rememberMe,
  requestId,
  sessionId,
  isSimulation = false,
}) => {
  if (!email || isSimulation || isSuppressedRecipient(email)) return false;

  try {
    await sendEmail({
      to: email,
      subject: "Security Alert: New Login to Your Account",
      html: newLoginTemplate({
        fullName,
        email,
        loginTime: loginTime || new Date(),
        ipAddress: ipAddress || "127.0.0.1",
        browser: browser || "Web Browser",
        operatingSystem: operatingSystem || "Unknown OS",
        device: device || "Desktop",
        authMethod: authMethod || "Email & Password",
        rememberMe: !!rememberMe,
        requestId: requestId || "",
        sessionId: sessionId || "",
      }),
    });
    console.log(`✅ [Security] Login notification email sent to ${email}`);
    return true;
  } catch (err) {
    console.error(`⚠️ [Security] Failed to deliver login notification email to ${email}:`, err.message);
    return false;
  }
};

module.exports = sendEmail;
module.exports.sendEmail = sendEmail;
module.exports.sendNewLoginNotification = sendNewLoginNotification;