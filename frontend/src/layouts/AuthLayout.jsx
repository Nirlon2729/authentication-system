import "./AuthLayout.css";

const AuthLayout = ({
  title,
  subtitle,
  children,
}) => {
  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-title">{title}</h1>

        {subtitle && (
          <p className="auth-subtitle">
            {subtitle}
          </p>
        )}

        {children}
      </div>
    </div>
  );
};

export default AuthLayout;