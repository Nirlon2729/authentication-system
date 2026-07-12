const passwordChangedTemplate = (name) => {
  return `
    <div style="font-family:Arial,sans-serif;background:#f5f5f5;padding:40px;">
      <div style="max-width:600px;margin:auto;background:#ffffff;border-radius:10px;padding:30px;">
        <h2 style="color:#2563eb;">Authentication System</h2>
        <p>Hello <strong>${name}</strong>,</p>
        <p>Your password has been changed successfully.</p>
        <p>If you did not perform this action, please reset your password immediately or contact support to secure your account.</p>
        <p>Thank you for keeping your account secure.</p>
        <hr>
        <p style="font-size:12px;color:gray;">© 2026 Authentication System</p>
      </div>
    </div>
  `;
};

module.exports = passwordChangedTemplate;
