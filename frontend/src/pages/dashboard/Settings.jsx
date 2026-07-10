import DashboardLayout from "../../layouts/DashboardLayout/DashboardLayout";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../../context/AuthContext";
import { deleteAccount } from "../../services/authService";

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

    alert("Account deleted successfully.");
  } catch (error) {
    console.error(error);

    alert(
      error.response?.data?.message ||
        "Failed to delete account."
    );
  } finally {
    setDeleting(false);
  }
};
  return (

    <DashboardLayout>
      <div
        style={{
          maxWidth: "900px",
          margin: "0 auto",
        }}
      >
        <h1>Account Settings</h1>

        <p
          style={{
            color: "#666",
            marginBottom: "30px",
          }}
        >
          Manage your account information and preferences.
        </p>

        <div
          style={{
            background: "#fff",
            padding: "30px",
            borderRadius: "12px",
            boxShadow: "0 10px 25px rgba(0,0,0,.08)",
          }}
        >
          <h2>Personal Information</h2>

          <hr />

          <div style={{ marginTop: "20px" }}>
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
        <div
  style={{
    background: "#fff",
    padding: "30px",
    borderRadius: "12px",
    boxShadow: "0 10px 25px rgba(0,0,0,.08)",
    marginTop: "30px",
  }}
>
  <h2>Appearance</h2>

  <hr />

  <div
    style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginTop: "20px",
    }}
  >
    <div>
      <h3>Dark Mode</h3>

      <p
        style={{
          color: "#666",
        }}
      >
        Switch between light and dark themes.
      </p>
    </div>

    <button
      disabled
      style={{
        padding: "10px 20px",
        cursor: "not-allowed",
      }}
    >
      Coming Soon
    </button>
  </div>
</div>
<div
  style={{
    background: "#fff",
    padding: "30px",
    borderRadius: "12px",
    boxShadow: "0 10px 25px rgba(0,0,0,.08)",
    marginTop: "30px",
  }}
>
  <h2>Account Actions</h2>

  <hr />

  <div
    style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginTop: "20px",
    }}
  >
    <div>
      <h3>Logout</h3>

      <p
        style={{
          color: "#666",
        }}
      >
        Sign out from your account.
      </p>
    </div>

    <button
      onClick={handleLogout}
      style={{
        padding: "10px 20px",
        background: "#dc3545",
        color: "#fff",
        border: "none",
        borderRadius: "8px",
        cursor: "pointer",
      }}
    >
      Logout
    </button>
  </div>
</div>
<div
  style={{
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: "30px",
    paddingTop: "20px",
    borderTop: "1px solid #ddd",
  }}
>
  <div>
    <h3 style={{ color: "#dc3545" }}>
      Delete Account
    </h3>

    <p
      style={{
        color: "#666",
      }}
    >
      Permanently delete your account and all associated data.
    </p>
  </div>

  <button
    onClick={handleDeleteAccount}
    disabled={deleting}
    style={{
      padding: "10px 20px",
      background: "#dc3545",
      color: "#fff",
      border: "none",
      borderRadius: "8px",
      cursor: deleting ? "not-allowed" : "pointer",
    }}
  >
    {deleting ? "Deleting..." : "Delete Account"}
  </button>
</div>
      </div>
    </DashboardLayout>
  );
};

export default Settings;