const emailChangedTemplate = (
  name,
  newEmail
) => {
  return `
    <div style="font-family:Arial,sans-serif;padding:30px">

      <h2>Hello ${name},</h2>

      <p>
        Your email address has been changed successfully.
      </p>

      <p>

        New Email

        <br><br>

        <strong>${newEmail}</strong>

      </p>

      <p>

        If this wasn't you,
        contact support immediately.

      </p>

    </div>
  `;
};

module.exports =
  emailChangedTemplate;