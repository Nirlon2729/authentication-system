import { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import DashboardLayout from "../../layouts/DashboardLayout/DashboardLayout";
import {
  ArrowLeft,
  KeyRound,
  Mail,
  Laptop,
  ShieldCheck,
  ShieldAlert,
} from "lucide-react";

import ChangePasswordForm from "../../components/security/ChangePasswordForm";
import CreatePasswordWizard from "../../components/security/CreatePasswordWizard";
import ActiveSessions from "../../components/security/ActiveSessions";
import ChangeEmailForm from "../../components/security/ChangeEmailForm";
import SecurityCard from "../../components/security/SecurityCard";

const Security = () => {
  const { user } = useAuth();
  const [activeSection, setActiveSection] = useState(null);

  const showCreatePassword =
    user?.provider === "google" && !user?.hasPassword;

  return (
    <DashboardLayout>
      <div style={{ maxWidth: "860px", margin: "0 auto", width: "100%" }}>
        {/* Header */}
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
            <ShieldCheck size={14} />
            <span>Identity & Credential Protection</span>
          </div>
          <h1
            style={{
              fontSize: "1.85rem",
              fontWeight: "800",
              color: "var(--text-primary)",
              letterSpacing: "-0.03em",
              margin: "0 0 0.35rem 0",
            }}
          >
            Security & Authentication
          </h1>
          <p
            style={{
              color: "var(--text-secondary)",
              fontSize: "0.92rem",
              margin: 0,
              lineHeight: 1.5,
            }}
          >
            Manage your account credentials, password policies, active multi-device sessions, and security verification.
          </p>
        </div>

        {/* Main Selection Cards */}
        {activeSection === null && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <SecurityCard
              icon={<KeyRound size={20} color="var(--primary-600)" />}
              title={showCreatePassword ? "Create Account Password" : "Change Password"}
              subtitle={
                showCreatePassword
                  ? "Set up a password to enable both Google and email login"
                  : "Update your password with email OTP verification"
              }
              badge={showCreatePassword ? "Action Recommended" : "Protected"}
              badgeType={showCreatePassword ? "warning" : "success"}
              onClick={() => setActiveSection("password")}
            />

            <SecurityCard
              icon={<Mail size={20} color="#10b981" />}
              title="Change Email Address"
              subtitle="Update your primary account email address and verify with OTP"
              badge={user?.isVerified ? "Verified" : "Unverified"}
              badgeType={user?.isVerified ? "success" : "warning"}
              onClick={() => setActiveSection("email")}
            />

            <SecurityCard
              icon={<Laptop size={20} color="#0ea5e9" />}
              title="Active Sessions & Devices"
              subtitle="Monitor and terminate active login sessions across all browsers and devices"
              badge="Active Protection"
              badgeType="success"
              onClick={() => setActiveSection("sessions")}
            />

            <SecurityCard
              icon={<ShieldAlert size={20} color="#f59e0b" />}
              title="Two-Factor Authentication (2FA)"
              subtitle="Add an extra layer of hardware authenticator protection (Authenticator App / FIDO2)"
              badge="Coming Soon"
              badgeType="neutral"
              disabled
            />
          </div>
        )}

        {/* Sub-Section Views */}
        {activeSection !== null && (
          <div>
            <button
              onClick={() => setActiveSection(null)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.5rem",
                background: "var(--bg-card)",
                padding: "0.6rem 1.1rem",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border-color)",
                color: "var(--primary-600)",
                cursor: "pointer",
                fontSize: "0.88rem",
                marginBottom: "1.75rem",
                fontWeight: "700",
                boxShadow: "var(--shadow-sm)",
                transition: "var(--transition-fast)",
              }}
            >
              <ArrowLeft size={16} />
              <span>Back to Security Overview</span>
            </button>

            <div
              style={{
                background: "var(--bg-card)",
                border: "1px solid var(--border-color)",
                borderRadius: "var(--radius-lg)",
                padding: "2rem",
                boxShadow: "var(--shadow-sm)",
              }}
            >
              {activeSection === "password" && (
                showCreatePassword ? <CreatePasswordWizard /> : <ChangePasswordForm />
              )}

              {activeSection === "email" && <ChangeEmailForm />}

              {activeSection === "sessions" && <ActiveSessions />}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Security;