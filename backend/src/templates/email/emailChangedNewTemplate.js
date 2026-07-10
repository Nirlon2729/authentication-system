const emailChangedNewTemplate = (
  name
) => {
  return `
    <div style="font-family:Arial,sans-serif;padding:30px">

      <h2>Hello ${name},</h2>

      <p>
        Your email has been verified successfully.
      </p>

      <p>
        This email is now connected
        to your account.
      </p>

      <p>
        Thank you for keeping
        your account secure.
      </p>

    </div>
  `;
};

module.exports =
  emailChangedNewTemplate;