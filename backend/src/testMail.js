require("dotenv").config();

const sendEmail = require("./services/emailService");
const otpTemplate = require("./templates/email/otpTemplate");

(async () => {
  try {
    await sendEmail({
      to: process.env.EMAIL_USER,
      subject: "OTP Test",
      html: otpTemplate("Nirlon", "123456"),
    });

    console.log("✅ Email sent successfully.");
  } catch (err) {
    console.error(err);
  }
})();