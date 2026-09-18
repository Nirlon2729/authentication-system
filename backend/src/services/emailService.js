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

const withTimeout = (promise, ms = 10000, errorMsg = "Email dispatch timed out.") => {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(errorMsg)), ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId);
  });
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

  const deliver = async () => {
    // 1. Primary Production Delivery: Brevo HTTPS API (port 443, not blocked on Render Free tier)
    if (process.env.BREVO_API_KEY) {
      console.log("📨 Dispatching email via Brevo HTTPS API...");
      const brevoApiKey = process.env.BREVO_API_KEY.trim();
      const senderEmail = (
        process.env.BREVO_SENDER_EMAIL ||
        process.env.EMAIL_FROM ||
        process.env.EMAIL_USER ||
        "no-reply@security.com"
      ).trim();
      const senderName = (
        process.env.BREVO_SENDER_NAME ||
        process.env.EMAIL_FROM_NAME ||
        "Authentication System"
      ).trim();
      const recipientEmail = (to || "").trim().toLowerCase();

      // Clean plain-text content extracted from HTML
      const textContent = html
        ? html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
        : undefined;

      const payload = {
        sender: {
          name: senderName,
          email: senderEmail,
        },
        to: [{ email: recipientEmail }],
        subject: subject,
        htmlContent: html,
      };
      if (textContent) {
        payload.textContent = textContent;
      }

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const response = await fetch("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          headers: {
            accept: "application/json",
            "api-key": brevoApiKey,
            "content-type": "application/json",
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        let data = {};
        try {
          data = await response.json();
        } catch {
          data = { raw: "Non-JSON response from Brevo" };
        }

        if (!response.ok) {
          const detail = data.message || data.code || `HTTP status ${response.status}`;
          throw new Error(`Brevo API error (${response.status}): ${detail}`);
        }

        console.log("✅ Email dispatched successfully via Brevo HTTPS API:", data.messageId || "OK");
        return data;
      } catch (error) {
        const errorMsg =
          error.name === "AbortError"
            ? "Brevo HTTPS API request timed out after 10s"
            : error.message;
        console.error("❌ Brevo HTTPS API email delivery failed:", errorMsg);
        // STRICT REQUIREMENT: DO NOT FALL BACK TO SMTP WHEN BREVO_API_KEY IS CONFIGURED
        throw new Error(`Brevo email delivery failed: ${errorMsg}`);
      }
    }

    // 2. Resend HTTPS API (port 443) - only if BREVO_API_KEY is not configured
    if (process.env.RESEND_API_KEY) {
      console.log("📨 Dispatching email via Resend HTTPS API...");
      const resendApiKey = process.env.RESEND_API_KEY.trim();
      const fromAddress = (
        process.env.EMAIL_FROM ||
        (process.env.EMAIL_USER && process.env.EMAIL_USER.includes("@")
          ? `Authentication System <${process.env.EMAIL_USER.trim()}>`
          : "Authentication System <onboarding@resend.dev>")
      ).trim();
      const recipientEmail = (to || "").trim().toLowerCase();

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: fromAddress,
            to: [recipientEmail],
            subject: subject,
            html: html,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        let data = {};
        try {
          data = await response.json();
        } catch {
          data = { raw: "Non-JSON response from Resend" };
        }

        if (!response.ok) {
          const detail = data.message || data.name || `HTTP status ${response.status}`;
          throw new Error(`Resend API error (${response.status}): ${detail}`);
        }

        console.log("✅ Email dispatched successfully via Resend HTTPS API:", data.id || "OK");
        return data;
      } catch (error) {
        const errorMsg =
          error.name === "AbortError"
            ? "Resend HTTPS API request timed out after 10s"
            : error.message;
        console.error("❌ Resend HTTPS API email delivery failed:", errorMsg);
        // STRICT REQUIREMENT: DO NOT FALL BACK TO SMTP WHEN RESEND_API_KEY IS CONFIGURED
        throw new Error(`Resend email delivery failed: ${errorMsg}`);
      }
    }

    // 3. Fallback to Nodemailer SMTP ONLY if NEITHER Brevo NOR Resend is configured
    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      try {
        console.log("📨 Dispatching email via SMTP...");
        const info = await transporter.sendMail({
          from: `"Authentication System" <${process.env.EMAIL_USER}>`,
          to,
          subject,
          html,
        });

        console.log("✅ Email sent via SMTP:", info.response);
        return info;
      } catch (error) {
        console.error("❌ SMTP email delivery failed:", error.message);
        throw new Error(`SMTP email delivery failed: ${error.message}`);
      }
    }

    throw new Error(
      "No email service configured. Please configure BREVO_API_KEY, RESEND_API_KEY, or EMAIL_USER/EMAIL_PASS."
    );
  };

  return await withTimeout(deliver(), 10000, "Email delivery timed out after 10 seconds.");
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