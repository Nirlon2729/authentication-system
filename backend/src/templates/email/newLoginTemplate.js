/**
 * Escapes unsafe characters for HTML injection protection
 */
const sanitizeHtml = (str) => {
  if (typeof str !== "string") return String(str || "");
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

/**
 * Generates responsive HTML email template for new login notifications
 */
const newLoginTemplate = ({
  fullName = "User",
  email = "",
  loginTime = new Date(),
  ipAddress = "127.0.0.1",
  browser = "Chrome",
  operatingSystem = "Windows",
  device = "Desktop",
  authMethod = "Email & Password",
  rememberMe = false,
  requestId = "",
  sessionId = "",
}) => {
  const safeName = sanitizeHtml(fullName || "User");
  const safeEmail = sanitizeHtml(email);
  const safeIP = sanitizeHtml(ipAddress);
  const safeBrowser = sanitizeHtml(browser);
  const safeOS = sanitizeHtml(operatingSystem);
  const safeDevice = sanitizeHtml(device);
  const safeAuthMethod = sanitizeHtml(authMethod);
  const safeRemember = rememberMe ? "Yes" : "No";
  const safeRequestId = sanitizeHtml(requestId || "N/A");
  const safeSessionId = sanitizeHtml(sessionId ? String(sessionId).slice(-8) : "Active");
  const formattedTime = new Date(loginTime).toUTCString();

  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>New Login to Your Account</title>
    <style>
      body {
        margin: 0;
        padding: 0;
        background-color: #f8fafc;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
        color: #0f172a;
      }
      .email-wrapper {
        max-width: 580px;
        margin: 30px auto;
        background-color: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 10px;
        overflow: hidden;
      }
      .email-header {
        background-color: #0f172a;
        color: #ffffff;
        padding: 24px 30px;
        display: flex;
        align-items: center;
      }
      .email-header h1 {
        margin: 0;
        font-size: 18px;
        font-weight: 700;
        letter-spacing: -0.01em;
      }
      .email-body {
        padding: 30px;
      }
      .security-badge {
        display: inline-block;
        background-color: #ecfdf5;
        color: #065f46;
        border: 1px solid #a7f3d0;
        font-size: 12px;
        font-weight: 700;
        padding: 4px 10px;
        border-radius: 4px;
        text-transform: uppercase;
        margin-bottom: 16px;
      }
      .login-title {
        font-size: 20px;
        font-weight: 700;
        margin: 0 0 10px 0;
        color: #0f172a;
      }
      .login-desc {
        font-size: 14px;
        line-height: 1.6;
        color: #475569;
        margin-bottom: 22px;
      }
      .details-table {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 24px;
        background-color: #f8fafc;
        border-radius: 8px;
        overflow: hidden;
        border: 1px solid #e2e8f0;
      }
      .details-table td {
        padding: 10px 14px;
        font-size: 13px;
        border-bottom: 1px solid #e2e8f0;
      }
      .details-table tr:last-child td {
        border-bottom: none;
      }
      .details-table td.label {
        font-weight: 600;
        color: #64748b;
        width: 38%;
      }
      .details-table td.value {
        color: #0f172a;
        font-weight: 500;
      }
      .action-box {
        background-color: #f1f5f9;
        border-left: 4px solid #3b82f6;
        padding: 14px 16px;
        font-size: 13px;
        color: #334155;
        line-height: 1.5;
        margin-bottom: 24px;
        border-radius: 0 6px 6px 0;
      }
      .email-footer {
        border-top: 1px solid #e2e8f0;
        padding: 20px 30px;
        font-size: 12px;
        color: #94a3b8;
        background-color: #f8fafc;
        text-align: center;
      }
    </style>
  </head>
  <body>
    <div class="email-wrapper">
      <div class="email-header">
        <h1>AuthCore Security Gateway</h1>
      </div>
      <div class="email-body">
        <div class="security-badge">New Session Alert</div>
        <h2 class="login-title">New Login to Your Account</h2>
        <p class="login-desc">
          Hello <strong>${safeName}</strong>,<br><br>
          A new login to your account (<strong>${safeEmail}</strong>) was detected.
        </p>

        <table class="details-table">
          <tr>
            <td class="label">Login Time</td>
            <td class="value">${formattedTime}</td>
          </tr>
          <tr>
            <td class="label">IP Address</td>
            <td class="value"><code>${safeIP}</code></td>
          </tr>
          <tr>
            <td class="label">Browser</td>
            <td class="value">${safeBrowser}</td>
          </tr>
          <tr>
            <td class="label">Operating System</td>
            <td class="value">${safeOS}</td>
          </tr>
          <tr>
            <td class="label">Device</td>
            <td class="value">${safeDevice}</td>
          </tr>
          <tr>
            <td class="label">Authentication Method</td>
            <td class="value">${safeAuthMethod}</td>
          </tr>
          <tr>
            <td class="label">Remember Me</td>
            <td class="value">${safeRemember}</td>
          </tr>
          <tr>
            <td class="label">Request ID</td>
            <td class="value"><code style="font-size: 11px;">${safeRequestId}</code></td>
          </tr>
          <tr>
            <td class="label">Session ID</td>
            <td class="value"><code style="font-size: 11px;">#...${safeSessionId}</code></td>
          </tr>
        </table>

        <div class="action-box">
          <strong>If this was you:</strong><br>
          You can safely ignore this message.<br><br>
          <strong>If this was not you:</strong><br>
          Please secure your account immediately by changing your password and reviewing active sessions in your Security settings.
        </div>
      </div>
      <div class="email-footer">
        This is an automated security notification regarding identity and access events on your account.<br>
        © ${new Date().getFullYear()} AuthCore Security. All rights reserved.
      </div>
    </div>
  </body>
  </html>
  `;
};

module.exports = newLoginTemplate;
