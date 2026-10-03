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
 * Generates responsive HTML email template for suspicious or notable login alerts.
 */
const suspiciousLoginAlertTemplate = ({
  fullName = "User",
  email = "",
  loginTime = new Date(),
  ipAddress = "127.0.0.1",
  browser = "Chrome",
  operatingSystem = "Windows",
  device = "Desktop",
  location = "Unknown Location",
  authMethod = "Email & Password",
  riskLevel = "MEDIUM",
  riskReasons = [],
  actionUrl = "http://localhost:5174/dashboard/security",
}) => {
  const safeName = sanitizeHtml(fullName || "User");
  const safeEmail = sanitizeHtml(email);
  const safeIP = sanitizeHtml(ipAddress);
  const safeBrowser = sanitizeHtml(browser);
  const safeOS = sanitizeHtml(operatingSystem);
  const safeDevice = sanitizeHtml(device);
  const safeLocation = sanitizeHtml(location);
  const safeAuthMethod = sanitizeHtml(authMethod);
  const safeActionUrl = sanitizeHtml(actionUrl);
  const formattedTime = new Date(loginTime).toUTCString();

  const badgeColors = {
    LOW: { bg: "#ecfdf5", border: "#a7f3d0", text: "#065f46", label: "Low Risk Sign-In" },
    MEDIUM: { bg: "#fffbeb", border: "#fde68a", text: "#92400e", label: "New Device / Location Alert" },
    HIGH: { bg: "#fff1f2", border: "#fecdd3", text: "#9f1239", label: "Suspicious Activity Detected" },
    CRITICAL: { bg: "#450a0a", border: "#ef4444", text: "#fee2e2", label: "CRITICAL: Urgent Security Alert" },
  };

  const badge = badgeColors[riskLevel] || badgeColors.MEDIUM;

  const reasonsListHtml = Array.isArray(riskReasons) && riskReasons.length > 0
    ? riskReasons.map((r) => `<li style="margin-bottom: 6px; color: #475569;">${sanitizeHtml(r)}</li>`).join("")
    : "<li style=\"color: #475569;\">Sign-in from a new device or network.</li>";

  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Security Alert - Account Activity</title>
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
        background-color: ${badge.bg};
        color: ${badge.text};
        border: 1px solid ${badge.border};
        font-size: 12px;
        font-weight: 700;
        padding: 5px 12px;
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
        margin-bottom: 20px;
      }
      .reasons-box {
        background-color: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        padding: 14px 18px;
        margin-bottom: 22px;
      }
      .reasons-box h4 {
        margin: 0 0 8px 0;
        font-size: 13px;
        color: #0f172a;
        font-weight: 600;
      }
      .reasons-box ul {
        margin: 0;
        padding-left: 20px;
        font-size: 13px;
      }
      .details-table {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 24px;
        background-color: #ffffff;
        border-radius: 8px;
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
        width: 35%;
      }
      .details-table td.value {
        color: #0f172a;
        font-weight: 500;
      }
      .action-cta {
        margin: 24px 0;
        text-align: center;
      }
      .btn-secure {
        display: inline-block;
        background-color: #2563eb;
        color: #ffffff !important;
        text-decoration: none;
        font-weight: 600;
        font-size: 14px;
        padding: 12px 24px;
        border-radius: 6px;
      }
      .guidance-box {
        background-color: #f1f5f9;
        border-left: 4px solid #f59e0b;
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
        <h1>AuthCore Intelligent Account Protection</h1>
      </div>
      <div class="email-body">
        <div class="security-badge">${badge.label}</div>
        <h2 class="login-title">New Sign-In Detected on Your Account</h2>
        <p class="login-desc">
          Hello <strong>${safeName}</strong>,<br><br>
          Our security system detected a recent sign-in to your account (<strong>${safeEmail}</strong>) with unusual or new characteristics.
        </p>

        <div class="reasons-box">
          <h4>Security Analysis Reasons:</h4>
          <ul>
            ${reasonsListHtml}
          </ul>
        </div>

        <table class="details-table">
          <tr>
            <td class="label">Date & Time</td>
            <td class="value">${formattedTime}</td>
          </tr>
          <tr>
            <td class="label">Approx. Location</td>
            <td class="value"><strong>${safeLocation}</strong></td>
          </tr>
          <tr>
            <td class="label">Device & OS</td>
            <td class="value">${safeDevice} • ${safeOS}</td>
          </tr>
          <tr>
            <td class="label">Browser</td>
            <td class="value">${safeBrowser}</td>
          </tr>
          <tr>
            <td class="label">IP Address</td>
            <td class="value"><code>${safeIP}</code></td>
          </tr>
          <tr>
            <td class="label">Method</td>
            <td class="value">${safeAuthMethod}</td>
          </tr>
        </table>

        <div class="action-cta">
          <a href="${safeActionUrl}" class="btn-secure">Review & Secure My Account</a>
        </div>

        <div class="guidance-box">
          <strong>Was this you?</strong><br>
          If you just signed in, you can safely disregard this message. Your device has been added to your recognized devices.<br><br>
          <strong>Don't recognize this activity?</strong><br>
          Your account may be compromised. Open the link above to immediately terminate active sessions and reset your password.
        </div>
      </div>
      <div class="email-footer">
        Automated security notification from AuthCore Security & Authentication Portal.<br>
        © ${new Date().getFullYear()} AuthCore Inc. All rights reserved.
      </div>
    </div>
  </body>
  </html>
  `;
};

module.exports = suspiciousLoginAlertTemplate;
