const securityAlertTemplate = ({
  userEmail,
  userName = "User",
  eventTitle,
  description,
  timestamp = new Date(),
  ipAddress = "Unknown",
  device = "Unknown Device",
  actionTaken = "Monitored",
  isBlocked = false,
  recommendation = "If this wasn'\''t you, we recommend resetting your password immediately."
}) => {
  const formattedTime = new Date(timestamp).toUTCString();

  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Security Alert for Your Account</title>
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
        text-align: left;
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
      .alert-badge {
        display: inline-block;
        background-color: ${isBlocked ? '#fee2e2' : '#fef3c7'};
        color: ${isBlocked ? '#991b1b' : '#92400e'};
        font-size: 12px;
        font-weight: 700;
        padding: 4px 10px;
        border-radius: 4px;
        text-transform: uppercase;
        margin-bottom: 16px;
      }
      .alert-title {
        font-size: 18px;
        font-weight: 700;
        margin: 0 0 12px 0;
        color: #0f172a;
      }
      .alert-desc {
        font-size: 14px;
        line-height: 1.6;
        color: #475569;
        margin-bottom: 24px;
      }
      .details-table {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 24px;
        background-color: #f8fafc;
        border-radius: 6px;
        overflow: hidden;
      }
      .details-table td {
        padding: 10px 14px;
        font-size: 13px;
        border-bottom: 1px solid #e2e8f0;
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
      .recommendation-box {
        background-color: #f1f5f9;
        border-left: 4px solid #0f172a;
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
        <h1>AuthCore Security Center</h1>
      </div>
      <div class="email-body">
        <div class="alert-badge">${isBlocked ? 'Threat Blocked' : 'Security Notice'}</div>
        <h2 class="alert-title">${eventTitle}</h2>
        <p class="alert-desc">
          Hello ${userName || userEmail},<br><br>
          ${description}
        </p>

        <table class="details-table">
          <tr>
            <td class="label">Date & Time</td>
            <td class="value">${formattedTime}</td>
          </tr>
          <tr>
            <td class="label">Targeted Account</td>
            <td class="value">${userEmail}</td>
          </tr>
          <tr>
            <td class="label">IP Address</td>
            <td class="value">${ipAddress}</td>
          </tr>
          <tr>
            <td class="label">Device / Client</td>
            <td class="value">${device}</td>
          </tr>
          <tr>
            <td class="label">Action Taken</td>
            <td class="value"><strong>${actionTaken}</strong></td>
          </tr>
        </table>

        <div class="recommendation-box">
          <strong>Recommended Action:</strong><br>
          ${recommendation}
        </div>
      </div>
      <div class="email-footer">
        This is an automated security notice regarding your account identity and protection.<br>
        © ${new Date().getFullYear()} AuthCore Security. All rights reserved.
      </div>
    </div>
  </body>
  </html>
  `;
};

module.exports = securityAlertTemplate;
