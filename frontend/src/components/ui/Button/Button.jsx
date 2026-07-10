import { motion } from "framer-motion";
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
    <motion.button
      whileHover={
        !disabled && !loading
          ? { scale: 1.02 }
          : {}
      }
      whileTap={
        !disabled && !loading
          ? { scale: 0.98 }
          : {}
      }
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
          Please wait...
        </>
      ) : (
        <>
          {icon}
          {children}
        </>
      )}
    </motion.button>
  );
};

export default Button;