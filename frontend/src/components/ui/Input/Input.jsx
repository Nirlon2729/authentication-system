import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import "./Input.css";

const Input = ({
  label,
  type = "text",
  value,
  onChange,
  name,
  id,
  placeholder = "",
  error = "",
  disabled = false,
  required = false,
  icon = null,
  autoComplete,
  ...rest
}) => {
  const [showPassword, setShowPassword] = useState(false);

  const inputType =
    type === "password"
      ? showPassword
        ? "text"
        : "password"
      : type;

  return (
    <div className="input-group">
      {label && (
        <label htmlFor={id || name} className="input-label">
          {label} {required && <span className="required-star">*</span>}
        </label>
      )}

      <div className="input-wrapper">
        {icon && <div className="input-prefix-icon">{icon}</div>}

        <input
          id={id || name}
          className={`custom-input ${error ? "input-error" : ""} ${icon ? "has-prefix" : ""} ${type === "password" ? "has-toggle" : ""}`}
          type={inputType}
          name={name}
          value={value !== undefined && value !== null ? value : ""}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          autoComplete={autoComplete}
          {...rest}
        />

        {type === "password" && (
          <button
            type="button"
            className="toggle-password"
            onClick={() => setShowPassword(!showPassword)}
            disabled={disabled}
            aria-label={showPassword ? "Hide password" : "Show password"}
            tabIndex={-1}
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        )}
      </div>

      {error && <p className="input-error-text">{error}</p>}
    </div>
  );
};

export default Input;