import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ShieldCheck, Zap, Rocket, ArrowRight, Lock, Shield, Moon, Sun } from "lucide-react";
import Button from "../../components/ui/Button/Button";
import "../../styles/pages/landing.css";

const LandingPage = () => {
  const navigate = useNavigate();
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
    <div className="landing-page">
      {/* Top Header Bar */}
      <header className="nirlon-header-bar">
        <Link to="/welcome" className="nirlon-brand-block">
          <div className="nirlon-logo-box">
            <span>N</span>
          </div>
          <div className="nirlon-brand-text">
            <span className="brand-name">Nirlon Macwan</span>
            <span className="brand-sub">Full Stack Developer</span>
          </div>
        </Link>

        <button 
          className="nirlon-theme-toggle" 
          onClick={() => setDarkMode(!darkMode)}
          title="Toggle Dark/Light Mode"
        >
          {darkMode ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </header>

      {/* Main Hero Grid */}
      <main className="landing-hero-container">
        <div className="hero-content">
          <h1 className="hero-title">
            Build. Login. <span className="highlight-crimson">Grow.</span>
          </h1>

          <p className="hero-subtitle">
            A secure and seamless authentication experience for a better tomorrow.
          </p>

          <div className="feature-list">
            <div className="feature-item">
              <div className="feature-icon-badge">
                <ShieldCheck size={20} />
              </div>
              <div className="feature-text">
                <h4>Secure & Protected</h4>
                <p>Your data is safe with us.</p>
              </div>
            </div>

            <div className="feature-item">
              <div className="feature-icon-badge">
                <Zap size={20} />
              </div>
              <div className="feature-text">
                <h4>Seamless Experience</h4>
                <p>Quick and easy authentication.</p>
              </div>
            </div>

            <div className="feature-item">
              <div className="feature-icon-badge">
                <Rocket size={20} />
              </div>
              <div className="feature-text">
                <h4>Built for You</h4>
                <p>Designed to help you achieve more.</p>
              </div>
            </div>
          </div>

          <div className="hero-cta-row">
            <Button
              type="button"
              variant="primary"
              onClick={() => navigate("/")}
            >
              <span>Get Started</span>
              <ArrowRight size={18} />
            </Button>
          </div>
        </div>

        {/* Right 3D Shield Illustration Box */}
        <div className="hero-illustration-container">
          <div className="shield-3d-podium">
            <div className="shield-card-3d">
              <Shield size={90} className="shield-3d-icon" />
              <Lock size={36} className="lock-3d-overlay" />
            </div>
            <div className="podium-base" />
          </div>
        </div>
      </main>

      {/* Landing Footer */}
      <footer className="landing-footer">
        <p>&copy; 2024 Nirlon Macwan. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default LandingPage;
