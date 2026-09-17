import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "../../layouts/DashboardLayout/DashboardLayout";
import { useAuth } from "../../context/AuthContext";
import { deleteAccount } from "../../services/authService";
import { toast } from "react-toastify";
import {
  Sun,
  Moon,
  LogOut,
  Trash2,
  ShieldAlert,
  User,
  Sliders,
  Sparkles,
  Lock,
  X,
  AlertTriangle,
} from "lucide-react";
import Button from "../../components/ui/Button/Button";
import Input from "../../components/ui/Input/Input";
import "../../styles/pages/settings.css";

const Settings = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [deleting, setDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [confirmText, setConfirmText] = useState("");

  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem("nirlon_theme") === "dark";
  });

  const toggleTheme = () => {
    const nextTheme = !darkMode;
    setDarkMode(nextTheme);
    if (nextTheme) {
      document.body.classList.add("dark");
      localStorage.setItem("nirlon_theme", "dark");
    } else {
      document.body.classList.remove("dark");
      localStorage.setItem("nirlon_theme", "light");
    }
    toast.info(`Theme set to ${nextTheme ? "Dark" : "Light"} mode`);
  };

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  const handleConfirmDelete = async (e) => {
    if (e) e.preventDefault();

    if (confirmText.toLowerCase() !== "delete my account") {
      toast.error("Please type 'delete my account' to confirm.");
      return;
    }

    if (user.provider !== "google" && !deletePassword) {
      toast.error("Password is required to delete account.");
      return;
    }

    try {
      setDeleting(true);
      if (user.provider === "google") {
        await deleteAccount();
      } else {
        await deleteAccount(deletePassword);
      }

      logout();
      navigate("/");
      toast.success("Account permanently deleted.");
    } catch (error) {
      console.error(error);
      toast.error(
        error.response?.data?.message || "Failed to delete account."
      );
    } finally {
      setDeleting(false);
      setShowDeleteModal(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="settings-page">
        {/* Settings Header */}
        <div style={{ marginBottom: "2rem" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.4rem",
              padding: "0.3rem 0.85rem",
              background: "var(--primary-light)",
              color: "var(--primary-600)",
              borderRadius: "var(--radius-full)",
              fontSize: "0.78rem",
              fontWeight: "700",
              letterSpacing: "0.3px",
              border: "1px solid var(--primary-border)",
              marginBottom: "0.75rem",
            }}
          >
            <Sliders size={14} />
            <span>Application Preferences</span>
          </div>
          <h1 className="settings-title">Account Settings</h1>
          <p className="settings-subtitle">
            Manage your interface appearance, security preferences, session logouts, and data governance.
          </p>
        </div>

        {/* Card 1: User Profile Summary */}
        <div className="settings-card">
          <div className="settings-card-header">
            <div className="settings-icon-bubble bg-crimson">
              <User size={20} />
            </div>
            <div>
              <h2>Personal Information</h2>
              <p>Basic account identification details registered with AuthCore.</p>
            </div>
          </div>

          <div className="settings-info-list">
            <div className="settings-info-row">
              <span className="info-key">Full Name</span>
              <span className="info-val">{user?.fullName || "Not set"}</span>
            </div>
            <div className="settings-info-row">
              <span className="info-key">Email Address</span>
              <span className="info-val">{user?.email || "Not set"}</span>
            </div>
            <div className="settings-info-row">
              <span className="info-key">Phone Number</span>
              <span className="info-val">{user?.phone || "Not configured"}</span>
            </div>
            <div className="settings-info-row">
              <span className="info-key">Sign-In Provider</span>
              <span className="info-val" style={{ textTransform: "capitalize" }}>
                {user?.provider || "Local"}
              </span>
            </div>
            <div className="settings-info-row">
              <span className="info-key">Account Role</span>
              <span className="info-val" style={{ textTransform: "capitalize" }}>
                {user?.role || "User"}
              </span>
            </div>
          </div>
        </div>

        {/* Card 2: Appearance & Theme */}
        <div className="settings-card">
          <div className="settings-card-header">
            <div className="settings-icon-bubble bg-sky">
              {darkMode ? <Moon size={20} /> : <Sun size={20} />}
            </div>
            <div>
              <h2>Interface Appearance</h2>
              <p>Customize the visual theme and contrast preferences for your session.</p>
            </div>
          </div>

          <div className="settings-row">
            <div>
              <h3>{darkMode ? "Dark Theme Enabled" : "Light Theme Enabled"}</h3>
              <p>
                {darkMode
                  ? "High-contrast dark mode with deep burgundy accents."
                  : "Crisp white SaaS mode with crimson accents."}
              </p>
            </div>

            <button
              onClick={toggleTheme}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.5rem",
                padding: "0.6rem 1.25rem",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border-color)",
                background: "var(--bg-hover)",
                color: "var(--text-primary)",
                fontWeight: "700",
                fontSize: "0.85rem",
                cursor: "pointer",
                transition: "var(--transition-fast)",
              }}
            >
              {darkMode ? <Sun size={16} /> : <Moon size={16} />}
              <span>Switch to {darkMode ? "Light" : "Dark"}</span>
            </button>
          </div>
        </div>

        {/* Card 3: Session Actions */}
        <div className="settings-card">
          <div className="settings-card-header">
            <div className="settings-icon-bubble bg-orange">
              <LogOut size={20} />
            </div>
            <div>
              <h2>Account Sign-Out</h2>
              <p>Terminate your local session and clear authentication cookies.</p>
            </div>
          </div>

          <div className="settings-row">
            <div>
              <h3>Sign Out of AuthCore</h3>
              <p>You can sign back in anytime using your credentials or Google account.</p>
            </div>

            <button onClick={handleLogout} className="settings-btn-logout">
              <LogOut size={16} />
              <span>Sign Out</span>
            </button>
          </div>
        </div>

        {/* Card 4: Danger Zone */}
        <div className="settings-card danger-card">
          <div className="settings-card-header">
            <div className="settings-icon-bubble bg-danger">
              <ShieldAlert size={20} />
            </div>
            <div>
              <h2 style={{ color: "var(--danger)" }}>Danger Zone</h2>
              <p>Permanent actions that cannot be undone.</p>
            </div>
          </div>

          <div className="settings-row">
            <div>
              <h3 style={{ color: "var(--danger)" }}>Delete Account</h3>
              <p>Permanently remove your account, active sessions, and personal identity data.</p>
            </div>

            <button
              onClick={() => setShowDeleteModal(true)}
              className="settings-btn-danger"
            >
              <Trash2 size={16} />
              <span>Delete Account</span>
            </button>
          </div>
        </div>

        {/* Modal: Delete Account Confirmation */}
        {showDeleteModal && (
          <div className="modal-backdrop">
            <div className="delete-modal-box">
              <div className="modal-header-row">
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <div
                    style={{
                      width: "40px",
                      height: "40px",
                      borderRadius: "10px",
                      background: "rgba(239, 68, 68, 0.12)",
                      color: "#ef4444",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <AlertTriangle size={20} />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: "1.15rem", fontWeight: "800", color: "var(--text-primary)" }}>
                      Delete Account
                    </h3>
                    <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                      This action is permanent and cannot be reversed.
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setShowDeleteModal(false)}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--text-muted)",
                    cursor: "pointer",
                  }}
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleConfirmDelete} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                {user?.provider !== "google" && (
                  <Input
                    label="Current Password"
                    type="password"
                    placeholder="Enter your account password"
                    value={deletePassword}
                    onChange={(e) => setDeletePassword(e.target.value)}
                    required
                  />
                )}

                <Input
                  label='Type "delete my account" to confirm'
                  placeholder="delete my account"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  required
                />

                <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "0.5rem" }}>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setShowDeleteModal(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="danger"
                    loading={deleting}
                    disabled={confirmText.toLowerCase() !== "delete my account"}
                  >
                    Permanently Delete
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Settings;