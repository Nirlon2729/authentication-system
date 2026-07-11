const transporter = require("../config/mail");

const sendEmail = async ({ to, subject, html }) => {
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