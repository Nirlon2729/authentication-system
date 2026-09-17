import { Loader2 } from "lucide-react";
import clsx from "clsx";
import "./Button.css";

const Button = ({
  children,
  type = "button",
  onClick,
  disabled = false,
  loading = false,
  variant = "primary",
  size = "md",
  fullWidth = false,
  icon = null,
}) => {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={clsx(
        "btn",
        `btn-${variant}`,
        `btn-${size}`,
        {
          "btn-full": fullWidth,
        }
      )}
    >
      {loading ? (
        <>
          <Loader2
            size={18}
            className="btn-spinner"
          />
          <span>Please wait...</span>
        </>
      ) : (
        <>
          {icon}
          {children}
        </>
      )}
    </button>
  );
};

export default Button;