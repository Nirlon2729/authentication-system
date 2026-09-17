import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import "./Input.css";

const Input = ({
  label,
  type = "text",
  value,
  onChange,
  name,
  placeholder = "",
  error = "",
  disabled = false,
  required = false,
  icon = null,
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
      {label && <label className="input-label">{label}</label>}

      <div className="input-wrapper">
        {icon && <div className="input-prefix-icon">{icon}</div>}

        <input
          className={`custom-input ${error ? "input-error" : ""} ${icon ? "has-prefix" : ""}`}
          type={inputType}
          name={name}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
        />

        {type === "password" && (
          <button
            type="button"
            className="toggle-password"
            onClick={() => setShowPassword(!showPassword)}
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