import { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import DashboardLayout from "../../layouts/DashboardLayout/DashboardLayout";

import ChangePasswordForm from "../../components/security/ChangePasswordForm";
import CreatePasswordWizard from "../../components/security/CreatePasswordWizard";
import ActiveSessions from "../../components/security/ActiveSessions";
import ChangeEmailForm from "../../components/security/ChangeEmailForm";
import SecurityCard from "../../components/security/SecurityCard";
const Security = () => {
  const { user } = useAuth();

  const [activeSection, setActiveSection] =
    useState(null);

  const showCreatePassword =
    user?.provider === "google" &&
    !user?.hasPassword;

  return (
    <DashboardLayout>
      <div
        style={{
          maxWidth: "700px",
          margin: "40px auto",
        }}
      >
    <h1>Security</h1>

    <hr
      style={{
        margin: "20px 0 30px",
      }}
    />

    {activeSection === null && (
  <>
    <SecurityCard
      icon="🔑"
      title="Change Password"
      subtitle="Update your account password"
      onClick={() =>
        setActiveSection("password")
      }
    />

    <SecurityCard
      icon="📧"
      title="Change Email"
      subtitle="Update your email address"
      onClick={() =>
        setActiveSection("email")
      }
    />

    <SecurityCard
      icon="💻"
      title="Active Sessions"
      subtitle="Manage your logged-in devices"
      onClick={() =>
        setActiveSection("sessions")
      }
    />

    <SecurityCard
      icon="🔐"
      title="Two-Factor Authentication"
      subtitle="Coming Soon"
      disabled
    />
  </>
)}

    {activeSection === "password" && (
      <>
        <button
          onClick={() =>
            setActiveSection(null)
          }
          style={backButton}
        >
          ← Back
        </button>

        {showCreatePassword ? (
          <CreatePasswordWizard />
        ) : (
          <ChangePasswordForm />
        )}
      </>
    )}

    {activeSection === "email" && (
      <>
        <button
          onClick={() =>
            setActiveSection(null)
          }
          style={backButton}
        >
          ← Back
        </button>

        <ChangeEmailForm />
      </>
    )}

    {activeSection === "sessions" && (
      <>
        <button
          onClick={() =>
            setActiveSection(null)
          }
          style={backButton}
        >
          ← Back
        </button>

        <ActiveSessions />
      </>
    )}
      </div>
    </DashboardLayout>
  );
};
const backButton = {
  border: "none",
  background: "none",
  color: "#2563eb",
  cursor: "pointer",
  fontSize: "16px",
  marginBottom: "20px",
  fontWeight: "600",
};
export default Security;