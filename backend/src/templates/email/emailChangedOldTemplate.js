const emailChangedOldTemplate = (
  name,
  newEmail
) => {
  return `
    <div style="font-family:Arial,sans-serif;padding:30px">

      <h2>Hello ${name},</h2>

      <p>
        Your account email has been changed.
      </p>

      <p>
        New Email:
        <strong>${newEmail}</strong>
      </p>

      <p>
        If you did NOT perform this action,
        please reset your password immediately
        and contact support.
      </p>

    </div>
  `;
};

module.exports =
  emailChangedOldTemplate;