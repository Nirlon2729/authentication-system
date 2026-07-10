const changeEmailOTPTemplate = (
  name,
  otp
) => {
  return `
    <div style="font-family:Arial,sans-serif;padding:30px">

      <h2>Hello ${name},</h2>

      <p>
        You requested to change your email address.
      </p>

      <p>
        Use the OTP below to verify your new email.
      </p>

      <h1
        style="
          letter-spacing:8px;
          color:#2563eb;
        "
      >
        ${otp}
      </h1>

      <p>
        This OTP expires in 10 minutes.
      </p>

      <p>
        If you didn't request this,
        you can safely ignore this email.
      </p>

    </div>
  `;
};

module.exports =
  changeEmailOTPTemplate;