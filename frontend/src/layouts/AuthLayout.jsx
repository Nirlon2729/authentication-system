import { useState, useEffect } from "react";
import "./AuthLayout.css";
import { Moon, Sun, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";

const AuthLayout = ({
  title,
  subtitle,
  children,
}) => {
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem("nirlon_theme") === "dark";
  });

  useEffect(() => {
    if (darkMode) {
      document.body.classList.add("dark");
      localStorage.setItem("nirlon_theme", "dark");
    } else {
      document.body.classList.remove("dark");
      localStorage.setItem("nirlon_theme", "light");
    }
  }, [darkMode]);

  return (
    <div className="nirlon-auth-page">
      {/* Top Header Bar */}
      <header className="nirlon-header-bar">
        <Link to="/" className="nirlon-brand-block">
          <div className="nirlon-logo-box">
            <ShieldCheck size={20} />
          </div>
          <div className="nirlon-brand-text">
            <span className="brand-name">AuthCore</span>
            <span className="brand-sub">Security & Identity</span>
          </div>
        </Link>

        <button 
          className="nirlon-theme-toggle" 
          onClick={() => setDarkMode(!darkMode)}
          title="Toggle Dark/Light Mode"
          type="button"
        >
          {darkMode ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </header>

      {/* Main Content Area */}
      <div className="nirlon-auth-wrapper">
        <div className="nirlon-auth-card">
          {title && (
            <div className="nirlon-card-header">
              <h1 className="nirlon-title">{title}</h1>
              {subtitle && <p className="nirlon-subtitle">{subtitle}</p>}
            </div>
          )}

          <div className="nirlon-card-body">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;