const transporter = require("../config/mail");

const sendEmail = async ({ to, subject, html }) => {
  // If Brevo API key is available, send email via Brevo HTTPS API to bypass SMTP block
  if (process.env.BREVO_API_KEY) {
    try {
      console.log("📨 Sending email via Brevo HTTPS API...");
      const response = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          "accept": "application/json",
          "api-key": process.env.BREVO_API_KEY,
          "content-type": "application/json"
        },
        body: JSON.stringify({
          sender: {
            name: "Auth Portal",
            email: process.env.EMAIL_USER || "no-reply@authportal.com"
          },
          to: [{ email: to }],
          subject: subject,
          htmlContent: html
        })
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
    console.error("❌ Email failed:");
    console.error(error);

    throw error;
  }
};

module.exports = sendEmail;