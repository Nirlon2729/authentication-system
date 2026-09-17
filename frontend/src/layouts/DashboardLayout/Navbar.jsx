import { useState, useEffect, useRef } from "react";
import { useAuth } from "../../context/AuthContext";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Bell,
  Moon,
  Sun,
  Menu,
  ChevronDown,
  User,
  Settings,
  ShieldCheck,
  LogOut,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { toast } from "react-toastify";

const PAGE_METADATA = {
  "/dashboard": {
    title: "Dashboard Overview",
    subtitle: "Real-time summary of your authentication & account activity",
  },
  "/profile": {
    title: "My Profile",
    subtitle: "Manage your personal information, credentials, and verification status",
  },
  "/security": {
    title: "Security & Authentication",
    subtitle: "Protect your account with password, email OTP, and active sessions",
  },
  "/settings": {
    title: "Account Settings",
    subtitle: "Customize application preferences, appearance, and account options",
  },
  "/admin": {
    title: "User Directory & Access Control",
    subtitle: "Manage registered users, assign administrative roles, and inspect logs",
  },
};

const Navbar = ({ onToggleMobileMenu }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const userMenuRef = useRef(null);
  const notifRef = useRef(null);

  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem("authcore_theme") === "dark";
  });

  useEffect(() => {
    if (darkMode) {
      document.body.classList.add("dark");
      localStorage.setItem("authcore_theme", "dark");
    } else {
      document.body.classList.remove("dark");
      localStorage.setItem("authcore_theme", "light");
    }
  }, [darkMode]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setUserMenuOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    setUserMenuOpen(false);
    try {
      await logout();
      toast.success("Logged out successfully");
      navigate("/");
    } catch (err) {
      console.error(err);
      toast.error("Logout failed");
    }
  };

  const meta = PAGE_METADATA[location.pathname] || {
    title: "Dashboard",
    subtitle: "Authentication and security platform",
  };

  const isAdmin = user?.role === "admin" || user?.email === "nirlonmacwan27@gmail.com";

  return (
    <header className="navbar-header">
      {/* Left side: Hamburger + Page Title & Breadcrumb */}
      <div className="navbar-left">
        <button
          className="mobile-hamburger-btn"
          onClick={onToggleMobileMenu}
          aria-label="Open mobile menu"
        >
          <Menu size={20} />
        </button>

        <div className="navbar-title-group">
          <h1 className="navbar-page-title">{meta.title}</h1>
          <p className="navbar-page-subtitle">{meta.subtitle}</p>
        </div>
      </div>

      {/* Right side: Actions & User Dropdown */}
      <div className="navbar-right">
        {/* Theme Switcher Button */}
        <button
          className="navbar-icon-action-btn"
          onClick={() => setDarkMode(!darkMode)}
          title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
          aria-label="Toggle theme"
        >
          {darkMode ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        {/* Notifications Popover */}
        <div className="navbar-popover-wrapper" ref={notifRef}>
          <button
            className={`navbar-icon-action-btn ${notifOpen ? "active" : ""}`}
            onClick={() => {
              setNotifOpen(!notifOpen);
              setUserMenuOpen(false);
            }}
            title="Notifications"
            aria-label="View notifications"
          >
            <Bell size={18} />
            <span className="notif-indicator-dot" />
          </button>

          {notifOpen && (
            <div className="notif-dropdown-card">
              <div className="dropdown-card-header">
                <h3>Notifications</h3>
                <span className="notif-count-badge">2 new</span>
              </div>
              <div className="notif-items-list">
                <div className="notif-item unread">
                  <div className="notif-item-icon success">
                    <CheckCircle2 size={16} />
                  </div>
                  <div className="notif-item-content">
                    <p className="notif-item-text">
                      {user?.isVerified
                        ? "Email address verified successfully."
                        : "Please verify your email address to secure your account."}
                    </p>
                    <span className="notif-item-time">Just now</span>
                  </div>
                </div>

                <div className="notif-item">
                  <div className="notif-item-icon info">
                    <AlertTriangle size={16} />
                  </div>
                  <div className="notif-item-content">
                    <p className="notif-item-text">
                      New login detected on Chrome (Current Device).
                    </p>
                    <span className="notif-item-time">Active now</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* User Profile Menu */}
        <div className="navbar-popover-wrapper" ref={userMenuRef}>
          <button
            className={`navbar-user-trigger-btn ${userMenuOpen ? "active" : ""}`}
            onClick={() => {
              setUserMenuOpen(!userMenuOpen);
              setNotifOpen(false);
            }}
            aria-expanded={userMenuOpen}
          >
            <img
              src={
                user?.profilePicture ||
                `https://ui-avatars.com/api/?name=${encodeURIComponent(
                  user?.fullName || "User"
                )}&background=8D0100&color=fff&bold=true`
              }
              alt={user?.fullName || "Profile"}
              className="navbar-avatar-img"
            />
            <div className="navbar-user-labels">
              <span className="navbar-user-fullname">{user?.fullName || "User Account"}</span>
              <span className="navbar-user-role-badge">
                {isAdmin ? "Super Admin" : "User"}
              </span>
            </div>
            <ChevronDown size={15} className={`chevron-icon ${userMenuOpen ? "open" : ""}`} />
          </button>

          {userMenuOpen && (
            <div className="user-menu-dropdown-card">
              <div className="user-menu-header">
                <p className="user-menu-signed">Signed in as</p>
                <p className="user-menu-email">{user?.email || "user@example.com"}</p>
              </div>

              <div className="user-menu-divider" />

              <div className="user-menu-links">
                <button
                  className="user-menu-link-item"
                  onClick={() => {
                    setUserMenuOpen(false);
                    navigate("/profile");
                  }}
                >
                  <User size={16} />
                  <span>My Profile</span>
                </button>

                <button
                  className="user-menu-link-item"
                  onClick={() => {
                    setUserMenuOpen(false);
                    navigate("/settings");
                  }}
                >
                  <Settings size={16} />
                  <span>Account Settings</span>
                </button>

                <button
                  className="user-menu-link-item"
                  onClick={() => {
                    setUserMenuOpen(false);
                    navigate("/security");
                  }}
                >
                  <ShieldCheck size={16} />
                  <span>Security & Sessions</span>
                </button>
              </div>

              <div className="user-menu-divider" />

              <div className="user-menu-footer">
                <button className="user-menu-logout-btn" onClick={handleLogout}>
                  <LogOut size={16} />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Navbar;