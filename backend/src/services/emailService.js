const transporter = require("../config/mail");

const sendEmail = async ({
  to,
  subject,
  html,
}) => {
  return await transporter.sendMail({
    from: `"Authentication System" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    html,
  });
};

module.exports = sendEmail;