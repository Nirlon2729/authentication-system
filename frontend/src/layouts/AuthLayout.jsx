import "./AuthLayout.css";
import { motion } from "framer-motion";

const AuthLayout = ({
  title,
  subtitle,
  children,
}) => {
  return (
    <div className="auth-page">
      <motion.div 
        className="auth-card"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
      >
        <h1 className="auth-title">{title}</h1>

        {subtitle && (
          <p className="auth-subtitle">
            {subtitle}
          </p>
        )}

        {children}
      </motion.div>
    </div>
  );
};

export default AuthLayout;