const welcomeTemplate = (fullName) => {
  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="UTF-8" />
    <title>Welcome</title>
  </head>

  <body
    style="
      margin:0;
      padding:0;
      background:#f5f7fb;
      font-family:Arial, Helvetica, sans-serif;
    "
  >

    <table
      width="100%"
      cellpadding="0"
      cellspacing="0"
      style="padding:40px 0;"
    >
      <tr>
        <td align="center">

          <table
            width="600"
            cellpadding="0"
            cellspacing="0"
            style="
              background:#ffffff;
              border-radius:10px;
              overflow:hidden;
              box-shadow:0 5px 20px rgba(0,0,0,.08);
            "
          >

            <tr>
              <td
                style="
                  background:#2563eb;
                  color:white;
                  text-align:center;
                  padding:30px;
                  font-size:28px;
                  font-weight:bold;
                "
              >
                🎉 Welcome to Auth Portal
              </td>
            </tr>

            <tr>
              <td
                style="
                  padding:40px;
                  color:#374151;
                  line-height:1.8;
                  font-size:16px;
                "
              >

                <h2 style="margin-top:0;">
                  Hi ${fullName},
                </h2>

                <p>
                  Welcome to <strong>Auth Portal</strong>!
                </p>

                <p>
                  Your account has been successfully created and your email has been verified.
                </p>

                <p>
                  We're excited to have you on board and hope you enjoy using our platform.
                </p>

                <p>
                  If you ever need assistance, feel free to contact us.
                </p>

                <br/>

                <p>
                  Best Regards,<br/>
                  <strong>Auth Portal Team</strong>
                </p>

              </td>
            </tr>

          </table>

        </td>
      </tr>
    </table>

  </body>
  </html>
  `;
};

module.exports = welcomeTemplate;