import DashboardLayout from "../../layouts/DashboardLayout/DashboardLayout";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { deleteAccount } from "../../services/authService";
import { toast } from "react-toastify";
import "../../styles/pages/settings.css";

const Settings = () => {
  const navigate = useNavigate();

  const { user, logout } = useAuth();
  const [deleting, setDeleting] = useState(false);
  const handleLogout = async () => {
    await logout();

    navigate("/");
  };
  const handleDeleteAccount = async () => {
    const confirmed = window.confirm(
      "Are you sure you want to permanently delete your account?"
    );

    if (!confirmed) return;

    try {
      setDeleting(true);

      if (user.provider === "google") {
        await deleteAccount();
      } else {
        const password = window.prompt(
          "Please enter your password to confirm:"
        );

        if (!password) {
          setDeleting(false);
          return;
        }

        await deleteAccount(password);
      }

      logout();

      navigate("/");

      toast.success("Account deleted successfully.");
    } catch (error) {
      console.error(error);

      toast.error(
        error.response?.data?.message ||
          "Failed to delete account."
      );
    } finally {
      setDeleting(false);
    }
  };
  return (
    <DashboardLayout>
      <div className="settings-page">
        <h1 className="settings-title">Account Settings</h1>

        <p className="settings-subtitle">
          Manage your account information and preferences.
        </p>

        <div className="settings-card">
          <h2>Personal Information</h2>

          <hr />

          <div className="settings-info-list">
            <p>
              <strong>Full Name:</strong> {user?.fullName}
            </p>

            <p>
              <strong>Email:</strong> {user?.email}
            </p>

            <p>
              <strong>Phone:</strong> {user?.phone || "Not Added"}
            </p>

            <p>
              <strong>Provider:</strong> {user?.provider}
            </p>

            <p>
              <strong>Role:</strong> {user?.role}
            </p>
          </div>
        </div>
        <div className="settings-card">
          <h2>Appearance</h2>

          <hr />

          <div className="settings-row">
            <div>
              <h3>Dark Mode</h3>

              <p>
                Switch between light and dark themes.
              </p>
            </div>

            <button disabled className="settings-btn-soon">
              Coming Soon
            </button>
          </div>
        </div>
        <div className="settings-card">
          <h2>Account Actions</h2>

          <hr />

          <div className="settings-row">
            <div>
              <h3>Logout</h3>

              <p>
                Sign out from your account.
              </p>
            </div>

            <button
              onClick={handleLogout}
              className="settings-btn-danger"
            >
              Logout
            </button>
          </div>
        </div>
        <div className="settings-danger-zone">
          <div>
            <h3 style={{ color: "var(--danger)" }}>
              Delete Account
            </h3>

            <p>
              Permanently delete your account and all associated data.
            </p>
          </div>

          <button
            onClick={handleDeleteAccount}
            disabled={deleting}
            className="settings-btn-danger"
          >
            {deleting ? "Deleting..." : "Delete Account"}
          </button>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Settings;