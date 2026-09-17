import { Link } from "react-router-dom";
import DashboardLayout from "../../layouts/DashboardLayout/DashboardLayout";
import { useAuth } from "../../context/AuthContext";
import {
  ShieldCheck,
  ShieldAlert,
  UserCheck,
  KeyRound,
  Laptop,
  Settings,
  Sparkles,
  ArrowRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  Globe,
  LogIn,
} from "lucide-react";
import "../../styles/pages/dashboard.css";

const Dashboard = () => {
  const { user } = useAuth();
  const firstName = user?.fullName ? user.fullName.split(" ")[0] : "User";

  const isSecured = user?.isVerified && (user?.provider === "google" || user?.hasPassword);

  return (
    <DashboardLayout>
      <div className="saas-dashboard">
        {/* Welcome Header */}
        <section className="dashboard-hero-banner">
          <div className="hero-content">
            <div className="hero-badge">
              <Sparkles size={14} />
              <span>{user?.role === "admin" ? "Admin Access Control" : "Authentication Portal"}</span>
            </div>
            <h1 className="hero-title">Welcome back, {firstName}! 👋</h1>
            <p className="hero-subtitle">
              Manage your personal security credentials, authentication sessions, and identity details in one secure place.
            </p>
          </div>
          <div className="hero-actions">
            <Link to="/profile" className="hero-btn hero-btn-primary">
              <span>View Profile</span>
              <ArrowRight size={16} />
            </Link>
            <Link to="/security" className="hero-btn hero-btn-secondary">
              <span>Security Center</span>
            </Link>
          </div>
        </section>

        {/* 4 Metric Stat Cards */}
        <section className="saas-metrics-grid">
          <div className="metric-card">
            <div className="metric-icon bg-emerald">
              {user?.isBlocked ? <ShieldAlert size={22} /> : <ShieldCheck size={22} />}
            </div>
            <div className="metric-info">
              <span className="metric-label">Account Status</span>
              <h3 className="metric-value">{user?.isBlocked ? "Suspended" : "Active & Healthy"}</h3>
              <span className="metric-sub status-positive">
                <CheckCircle2 size={13} />
                <span>Protected by AuthCore</span>
              </span>
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-icon bg-crimson">
              <UserCheck size={22} />
            </div>
            <div className="metric-info">
              <span className="metric-label">Account Role</span>
              <h3 className="metric-value" style={{ textTransform: "capitalize" }}>
                {user?.role || "User"}
              </h3>
              <span className="metric-sub">
                {user?.role === "admin" ? "Full administrative access" : "Standard member access"}
              </span>
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-icon bg-sky">
              <Globe size={22} />
            </div>
            <div className="metric-info">
              <span className="metric-label">Sign-In Provider</span>
              <h3 className="metric-value" style={{ textTransform: "capitalize" }}>
                {user?.provider === "google" ? "Google OAuth" : "Email & Password"}
              </h3>
              <span className="metric-sub">
                {user?.provider === "google" ? "OAuth 2.0 Connected" : "Local Database Auth"}
              </span>
            </div>
          </div>

          <div className="metric-card">
            <div className={`metric-icon ${user?.isVerified ? "bg-emerald" : "bg-orange"}`}>
              {user?.isVerified ? <CheckCircle2 size={22} /> : <AlertCircle size={22} />}
            </div>
            <div className="metric-info">
              <span className="metric-label">Email Verification</span>
              <h3 className="metric-value">{user?.isVerified ? "Verified" : "Pending"}</h3>
              <span className={`metric-sub ${user?.isVerified ? "status-positive" : "status-warning"}`}>
                {user?.isVerified ? "Verified address" : "OTP confirmation needed"}
              </span>
            </div>
          </div>
        </section>

        {/* Quick Action Navigation Grid */}
        <section className="quick-actions-section">
          <h2 className="section-heading">Quick Security Actions</h2>
          <div className="quick-actions-grid">
            <Link to="/security" className="action-tile">
              <div className="action-tile-icon bg-crimson">
                <KeyRound size={20} />
              </div>
              <div className="action-tile-text">
                <h4>Password & Credentials</h4>
                <p>Change your password or link new authentication methods</p>
              </div>
              <ArrowRight size={18} className="tile-arrow" />
            </Link>

            <Link to="/security" className="action-tile">
              <div className="action-tile-icon bg-sky">
                <Laptop size={20} />
              </div>
              <div className="action-tile-text">
                <h4>Active Sessions</h4>
                <p>Review logged-in devices and revoke remote sessions</p>
              </div>
              <ArrowRight size={18} className="tile-arrow" />
            </Link>

            <Link to="/profile" className="action-tile">
              <div className="action-tile-icon bg-emerald">
                <UserCheck size={20} />
              </div>
              <div className="action-tile-text">
                <h4>Profile Information</h4>
                <p>Update your name, contact phone, and avatar photo</p>
              </div>
              <ArrowRight size={18} className="tile-arrow" />
            </Link>

            <Link to="/settings" className="action-tile">
              <div className="action-tile-icon bg-purple">
                <Settings size={20} />
              </div>
              <div className="action-tile-text">
                <h4>System Preferences</h4>
                <p>Customize theme, notification alerts, and account status</p>
              </div>
              <ArrowRight size={18} className="tile-arrow" />
            </Link>
          </div>
        </section>

        {/* 2-Column Summary Grid */}
        <section className="dashboard-two-col">
          {/* Account Summary Card */}
          <div className="dashboard-card">
            <div className="card-top-bar">
              <h3 className="card-heading">Account Overview</h3>
              <Link to="/profile" className="card-link">
                Edit
              </Link>
            </div>
            <div className="overview-list">
              <div className="overview-row">
                <span className="overview-label">Full Name</span>
                <strong className="overview-value">{user?.fullName || "Not provided"}</strong>
              </div>
              <div className="overview-row">
                <span className="overview-label">Email Address</span>
                <strong className="overview-value">{user?.email || "Not provided"}</strong>
              </div>
              <div className="overview-row">
                <span className="overview-label">Phone Number</span>
                <strong className="overview-value">{user?.phone || "Not configured"}</strong>
              </div>
              <div className="overview-row">
                <span className="overview-label">Member Since</span>
                <strong className="overview-value">
                  {user?.createdAt
                    ? new Date(user.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })
                    : "Recent"}
                </strong>
              </div>
              <div className="overview-row">
                <span className="overview-label">Last Sign-In</span>
                <strong className="overview-value">
                  {user?.lastLogin
                    ? new Date(user.lastLogin).toLocaleString("en-US", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })
                    : "Just now"}
                </strong>
              </div>
            </div>
          </div>

          {/* Security Health & Timeline Card */}
          <div className="dashboard-card">
            <div className="card-top-bar">
              <h3 className="card-heading">Security Health & Activity</h3>
              <span className={`health-badge ${isSecured ? "health-good" : "health-attention"}`}>
                {isSecured ? "Strong Security" : "Action Recommended"}
              </span>
            </div>

            <div className="security-timeline">
              <div className="timeline-item">
                <div className="timeline-bullet bg-emerald">
                  <CheckCircle2 size={14} />
                </div>
                <div className="timeline-content">
                  <p className="timeline-title">Email Verification</p>
                  <span className="timeline-desc">
                    {user?.isVerified
                      ? "Primary email address verified and active."
                      : "Please verify your email to unlock all features."}
                  </span>
                </div>
              </div>

              <div className="timeline-item">
                <div className="timeline-bullet bg-sky">
                  <LogIn size={14} />
                </div>
                <div className="timeline-content">
                  <p className="timeline-title">Current Authentication Session</p>
                  <span className="timeline-desc">
                    Signed in via {user?.provider === "google" ? "Google OAuth" : "Email & Password"}.
                  </span>
                </div>
              </div>

              <div className="timeline-item">
                <div className="timeline-bullet bg-crimson">
                  <Clock size={14} />
                </div>
                <div className="timeline-content">
                  <p className="timeline-title">Session Protection</p>
                  <span className="timeline-desc">
                    HttpOnly JWT cookies and rotating refresh tokens active.
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;