import "./PasswordStrength.css";

const PasswordStrength = ({ password }) => {
  let strength = 0;

  if (password.length >= 8) strength++;
  if (/[A-Z]/.test(password)) strength++;
  if (/[0-9]/.test(password)) strength++;
  if (/[^A-Za-z0-9]/.test(password)) strength++;

  const labels = [
    "Very Weak",
    "Weak",
    "Good",
    "Strong",
    "Very Strong",
  ];

  return (
    <div className="password-strength">
      <div
        className="strength-bar"
        style={{
          width: `${strength * 25}%`,
        }}
      />

      <small>
        {labels[strength]}
      </small>
    </div>
  );
};

export default PasswordStrength;