import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  ShieldCheck,
  User,
  Settings,
  Users,
  LogOut,
  X,
  Lock,
  ChevronRight,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { toast } from "react-toastify";

const Sidebar = ({ onCloseMobile, isMobile = false }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      if (onCloseMobile) onCloseMobile();
      await logout();
      toast.success("Logged out successfully");
      navigate("/");
    } catch (err) {
      console.error(err);
      toast.error("Logout failed");
    }
  };

  const isAdmin = user?.role === "admin";

  return (
    <div className="sidebar-container">
      {/* Sidebar Header / Brand */}
      <div className="sidebar-brand-section">
        <div className="sidebar-brand-link" onClick={() => navigate("/dashboard")}>
          <div className="sidebar-logo-icon">
            <Lock size={20} strokeWidth={2.5} />
          </div>
          <div className="sidebar-brand-text">
            <span className="brand-title">AuthCore</span>
            <span className="brand-badge">SaaS IAM</span>
          </div>
        </div>

        {isMobile && (
          <button
            className="sidebar-close-btn"
            onClick={onCloseMobile}
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        )}
      </div>

      {/* Navigation Sections */}
      <nav className="sidebar-nav-scroll" aria-label="Main Navigation">
        {/* MAIN SECTION */}
        <div className="sidebar-group">
          <span className="sidebar-group-title">MAIN</span>
          <div className="sidebar-nav-list">
            <NavLink
              to="/dashboard"
              className={({ isActive }) =>
                `sidebar-nav-item ${isActive ? "active" : ""}`
              }
              onClick={isMobile ? onCloseMobile : undefined}
            >
              <LayoutDashboard size={18} />
              <span>Dashboard</span>
              <ChevronRight size={14} className="nav-arrow" />
            </NavLink>

            <NavLink
              to="/security"
              className={({ isActive }) =>
                `sidebar-nav-item ${isActive ? "active" : ""}`
              }
              onClick={isMobile ? onCloseMobile : undefined}
            >
              <ShieldCheck size={18} />
              <span>Security</span>
              <ChevronRight size={14} className="nav-arrow" />
            </NavLink>

            {isAdmin && (
              <>
                <NavLink
                  to="/admin/security-gateway"
                  className={({ isActive }) =>
                    `sidebar-nav-item ${isActive ? "active" : ""}`
                  }
                  onClick={isMobile ? onCloseMobile : undefined}
                >
                  <ShieldCheck size={18} />
                  <span>AI Security Gateway</span>
                  <span className="nav-admin-badge" style={{ background: "#3b82f6" }}>SOC</span>
                </NavLink>

                <NavLink
                  to="/admin"
                  className={({ isActive }) =>
                    `sidebar-nav-item ${isActive ? "active" : ""}`
                  }
                  onClick={isMobile ? onCloseMobile : undefined}
                >
                  <Users size={18} />
                  <span>User Directory</span>
                  <span className="nav-admin-badge">Admin</span>
                </NavLink>
              </>
            )}
          </div>
        </div>

        {/* ACCOUNT SECTION */}
        <div className="sidebar-group">
          <span className="sidebar-group-title">ACCOUNT</span>
          <div className="sidebar-nav-list">
            <NavLink
              to="/profile"
              className={({ isActive }) =>
                `sidebar-nav-item ${isActive ? "active" : ""}`
              }
              onClick={isMobile ? onCloseMobile : undefined}
            >
              <User size={18} />
              <span>My Profile</span>
              <ChevronRight size={14} className="nav-arrow" />
            </NavLink>

            <NavLink
              to="/settings"
              className={({ isActive }) =>
                `sidebar-nav-item ${isActive ? "active" : ""}`
              }
              onClick={isMobile ? onCloseMobile : undefined}
            >
              <Settings size={18} />
              <span>Settings</span>
              <ChevronRight size={14} className="nav-arrow" />
            </NavLink>
          </div>
        </div>
      </nav>

      {/* Sidebar Footer / User Profile & Logout */}
      <div className="sidebar-footer-section">
        <div className="sidebar-user-card" onClick={() => navigate("/profile")}>
          <img
            src={
              user?.profilePicture ||
              `https://ui-avatars.com/api/?name=${encodeURIComponent(
                user?.fullName || "User"
              )}&background=8D0100&color=fff&bold=true`
            }
            alt={user?.fullName || "User Avatar"}
            className="sidebar-user-avatar"
          />
          <div className="sidebar-user-info">
            <span className="sidebar-user-name">{user?.fullName || "User Account"}</span>
            <span className="sidebar-user-role">
              {isAdmin ? "Super Admin" : "Verified User"}
            </span>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="sidebar-logout-button"
          title="Sign out of account"
        >
          <LogOut size={16} />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;