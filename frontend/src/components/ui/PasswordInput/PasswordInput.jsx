import { useState } from "react";
import "./PasswordInput.css";

const PasswordInput = ({
  label,
  name,
  value,
  onChange,
  placeholder = "Enter password",
  error,
  required = false,
  disabled = false,
}) => {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="password-group">
      {label && (
        <label className="password-label">
          {label}
          {required && <span className="required">*</span>}
        </label>
      )}

      <div className="password-wrapper">
        <input
          className={`password-input ${error ? "password-error" : ""}`}
          type={showPassword ? "text" : "password"}
          name={name}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
        />

        <button
          type="button"
          className="toggle-password"
          onClick={() => setShowPassword(!showPassword)}
        >
          {showPassword ? "Hide" : "Show"}
        </button>
      </div>

      {error && <p className="password-error-text">{error}</p>}
    </div>
  );
};

export default PasswordInput;