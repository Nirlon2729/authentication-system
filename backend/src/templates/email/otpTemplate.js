const otpTemplate = (name, otp) => {
  return `
    <div style="font-family:Arial,sans-serif;background:#f5f5f5;padding:40px;">
      <div style="max-width:600px;margin:auto;background:#ffffff;border-radius:10px;padding:30px;">

        <h2 style="color:#2563eb;">
          Authentication System
        </h2>

        <p>Hello <strong>${name}</strong>,</p>

        <p>Your One-Time Password is:</p>

        <h1 style="
          letter-spacing:10px;
          text-align:center;
          color:#2563eb;
        ">
          ${otp}
        </h1>

        <p>
          This OTP is valid for
          <strong>10 minutes</strong>.
        </p>

        <p>
          If you didn't request this,
          you can safely ignore this email.
        </p>

        <hr>

        <p style="font-size:12px;color:gray;">
          © 2026 Authentication System
        </p>

      </div>
    </div>
  `;
};

module.exports = otpTemplate;