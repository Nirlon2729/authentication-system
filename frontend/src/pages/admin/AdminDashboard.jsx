import { useState, useEffect, useCallback } from "react";
import DashboardLayout from "../../layouts/DashboardLayout/DashboardLayout";
import { useAuth } from "../../context/AuthContext";
import EmailOTPModal from "../../components/profile/EmailOTPModal";
import {
  fetchAllUsers,
  requestCreateAdminOTP,
  confirmCreateAdminOTP,
  updateUserRole,
  toggleUserBlock,
  deleteUserAccount,
  fetchAdminAnalytics,
} from "../../services/adminService";
import {
  ShieldCheck,
  Users,
  UserPlus,
  Activity,
  Search,
  UserCheck,
  UserX,
  Trash2,
  RefreshCw,
  Sparkles,
  CheckCircle2,
} from "lucide-react";
import Button from "../../components/ui/Button/Button";
import Input from "../../components/ui/Input/Input";
import PasswordInput from "../../components/ui/PasswordInput/PasswordInput";
import { toast } from "react-toastify";
import "../../styles/pages/admin.css";

const AdminDashboard = () => {
  const { user: currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState("users");
  const [users, setUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRole, setSelectedRole] = useState("all");
  const [analytics, setAnalytics] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  // New Admin Form & OTP Modal State
  const [newAdmin, setNewAdmin] = useState({
    fullName: "",
    email: "",
    password: "",
  });
  const [creatingAdmin, setCreatingAdmin] = useState(false);
  const [showAdminOtpModal, setShowAdminOtpModal] = useState(false);

  const loadAdminData = useCallback(async () => {
    setLoading(true);
    try {
      const [usersRes, analyticsRes] = await Promise.all([
        fetchAllUsers(searchQuery, selectedRole),
        fetchAdminAnalytics(),
      ]);
      setUsers(usersRes.users || []);
      setAnalytics(analyticsRes.analytics || null);
      setAuditLogs(analyticsRes.auditLogs || []);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load admin management data.");
    } finally {
      setLoading(false);
    }
  }, [searchQuery, selectedRole]);

  useEffect(() => {
    loadAdminData();
  }, [loadAdminData]);

  const handleCreateAdmin = async (e) => {
    e.preventDefault();
    if (!newAdmin.fullName || !newAdmin.email || !newAdmin.password) {
      toast.error("Please fill in all admin fields.");
      return;
    }

    setCreatingAdmin(true);
    try {
      await requestCreateAdminOTP(newAdmin);
      setShowAdminOtpModal(true);
      toast.info(`📧 Verification code sent to ${newAdmin.email}`);
    } catch (err) {
      toast.error(err.message || "Failed to send admin verification OTP.");
    } finally {
      setCreatingAdmin(false);
    }
  };

  const handleToggleRole = async (userId, currentRole) => {
    const nextRole = currentRole === "admin" ? "user" : "admin";
    try {
      await updateUserRole(userId, nextRole);
      toast.success(`User role updated to ${nextRole}`);
      loadAdminData();
    } catch (err) {
      toast.error(err.message || "Role update failed.");
    }
  };

  const handleToggleBlock = async (userId) => {
    try {
      await toggleUserBlock(userId);
      toast.info("User block status updated.");
      loadAdminData();
    } catch (err) {
      toast.error(err.message || "Action failed.");
    }
  };

  const handleDeleteUser = async (userId, userEmail) => {
    const confirmed = window.confirm(`Are you sure you want to delete user account ${userEmail}?`);
    if (!confirmed) return;

    try {
      await deleteUserAccount(userId);
      toast.success(`Account ${userEmail} deleted successfully.`);
      loadAdminData();
    } catch (err) {
      toast.error(err.message || "Delete failed.");
    }
  };

  return (
    <DashboardLayout>
      <div className="admin-portal-page">
        {/* Admin Welcome Banner */}
        <section className="admin-banner">
          <div>
            <div className="admin-badge-tag">
              <ShieldCheck size={16} />
              <span>Admin Access Control</span>
            </div>
            <h1 className="admin-title">
              User Directory & Permissions
            </h1>
            <p className="admin-subtitle">
              Logged in as <strong>{currentUser?.email}</strong>. Manage registered accounts, create secondary Admins, and monitor real-time audit logs.
            </p>
          </div>
          <Button variant="secondary" onClick={() => setActiveTab("create-admin")}>
            <UserPlus size={18} />
            <span>Create New Admin</span>
          </Button>
        </section>

        {/* Analytics Statistics Grid */}
        {analytics && (
          <section className="admin-stats-grid">
            <div className="stat-card stat-users">
              <div className="stat-icon bg-blue">
                <Users size={24} />
              </div>
              <div className="stat-info">
                <span className="stat-label">Total Users</span>
                <h3 className="stat-value">{analytics.totalUsers}</h3>
              </div>
            </div>

            <div className="stat-card stat-admins">
              <div className="stat-icon bg-purple">
                <ShieldCheck size={24} />
              </div>
              <div className="stat-info">
                <span className="stat-label">System Admins</span>
                <h3 className="stat-value">{analytics.totalAdmins}</h3>
              </div>
            </div>

            <div className="stat-card stat-verified">
              <div className="stat-icon bg-green">
                <CheckCircle2 size={24} />
              </div>
              <div className="stat-info">
                <span className="stat-label">Verification Rate</span>
                <h3 className="stat-value">{analytics.verificationRate}%</h3>
              </div>
            </div>

            <div className="stat-card stat-sessions">
              <div className="stat-icon bg-orange">
                <Activity size={24} />
              </div>
              <div className="stat-info">
                <span className="stat-label">Active Audit Logs</span>
                <h3 className="stat-value">{auditLogs.length}</h3>
              </div>
            </div>
          </section>
        )}

        {/* Admin Tabbed Navigation */}
        <div className="admin-tab-nav">
          <button
            className={`admin-tab-btn ${activeTab === "users" ? "active" : ""}`}
            onClick={() => setActiveTab("users")}
          >
            <Users size={18} />
            <span>User & Admin Directory ({users.length})</span>
          </button>
          <button
            className={`admin-tab-btn ${activeTab === "create-admin" ? "active" : ""}`}
            onClick={() => setActiveTab("create-admin")}
          >
            <UserPlus size={18} />
            <span>Create New Admin</span>
          </button>
          <button
            className={`admin-tab-btn ${activeTab === "logs" ? "active" : ""}`}
            onClick={() => setActiveTab("logs")}
          >
            <Activity size={18} />
            <span>Transaction & Audit Logs ({auditLogs.length})</span>
          </button>
        </div>

        {/* Tab 1: User & Admin Directory */}
        {activeTab === "users" && (
          <div className="admin-card">
            <div className="table-filter-bar">
              <div className="search-box">
                <Search size={18} className="search-icon" />
                <input
                  type="text"
                  placeholder="Search accounts by name or email address..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="admin-search-input"
                />
              </div>

              <div className="role-filter-group">
                <button
                  className={`filter-btn ${selectedRole === "all" ? "active" : ""}`}
                  onClick={() => setSelectedRole("all")}
                >
                  All Accounts
                </button>
                <button
                  className={`filter-btn ${selectedRole === "user" ? "active" : ""}`}
                  onClick={() => setSelectedRole("user")}
                >
                  Users Only
                </button>
                <button
                  className={`filter-btn ${selectedRole === "admin" ? "active" : ""}`}
                  onClick={() => setSelectedRole("admin")}
                >
                  Admins Only
                </button>
              </div>
            </div>

            {loading ? (
              <div className="admin-loading">
                <RefreshCw size={28} className="spin-icon" />
                <p>Loading directory...</p>
              </div>
            ) : users.length === 0 ? (
              <div className="empty-table-box">
                <Users size={36} />
                <p>No accounts found matching your query.</p>
              </div>
            ) : (
              <div className="table-container">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Account User</th>
                      <th>Role</th>
                      <th>Provider</th>
                      <th>Email Verified</th>
                      <th>Status</th>
                      <th>Created At</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((usr) => (
                      <tr key={usr._id} className={usr.isBlocked ? "row-blocked" : ""}>
                        <td>
                          <div className="table-user-cell">
                            <img
                              src={
                                usr.profilePicture ||
                                `https://ui-avatars.com/api/?name=${encodeURIComponent(usr.fullName || "User")}`
                              }
                              alt={usr.fullName}
                              className="table-avatar"
                            />
                            <div>
                              <strong className="user-cell-name">{usr.fullName}</strong>
                              <span className="user-cell-email">{usr.email}</span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className={`role-pill role-${usr.role}`}>
                            {usr.role === "admin" ? "🛡️ Admin" : "👤 User"}
                          </span>
                        </td>
                        <td>
                          <span className="provider-tag">{usr.provider || "local"}</span>
                        </td>
                        <td>
                          <span className={`verify-dot ${usr.isVerified ? "verified" : "unverified"}`}>
                            {usr.isVerified ? "Verified ✅" : "Unverified ⚠️"}
                          </span>
                        </td>
                        <td>
                          <span className={`status-pill ${usr.isBlocked ? "blocked" : "active"}`}>
                            {usr.isBlocked ? "Blocked 🚫" : "Active 🟢"}
                          </span>
                        </td>
                        <td className="date-cell">
                          {usr.createdAt
                            ? new Date(usr.createdAt).toLocaleDateString("en-IN", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              })
                            : "-"}
                        </td>
                        <td>
                          <div className="action-buttons-cell">
                            <button
                              title={usr.role === "admin" ? "Demote to User" : "Promote to Admin"}
                              className="action-btn role-btn"
                              onClick={() => handleToggleRole(usr._id, usr.role)}
                            >
                              <ShieldCheck size={16} />
                            </button>
                            <button
                              title={usr.isBlocked ? "Unblock Account" : "Block Account"}
                              className="action-btn block-btn"
                              onClick={() => handleToggleBlock(usr._id)}
                            >
                              {usr.isBlocked ? <UserCheck size={16} /> : <UserX size={16} />}
                            </button>
                            {usr.email !== "nirlonmacwan27@gmail.com" && (
                              <button
                                title="Delete Account"
                                className="action-btn delete-btn"
                                onClick={() => handleDeleteUser(usr._id, usr.email)}
                              >
                                <Trash2 size={16} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Create New Admin */}
        {activeTab === "create-admin" && (
          <div className="admin-card create-admin-card">
            <div className="card-form-header">
              <div className="form-icon-circle">
                <UserPlus size={28} />
              </div>
              <div>
                <h2>Create Secondary Admin Account</h2>
                <p>Created Admin accounts will have full administrative privileges and can log in directly from the main login page.</p>
              </div>
            </div>

            <form onSubmit={handleCreateAdmin} className="create-admin-form">
              <Input
                label="Admin Full Name"
                placeholder="e.g. Sarah Jenkins (Admin)"
                value={newAdmin.fullName}
                onChange={(e) => setNewAdmin({ ...newAdmin, fullName: e.target.value })}
                required
              />
              <Input
                label="Admin Email Address"
                type="email"
                placeholder="admin@example.com"
                value={newAdmin.email}
                onChange={(e) => setNewAdmin({ ...newAdmin, email: e.target.value })}
                required
              />
              <PasswordInput
                label="Admin Password"
                placeholder="Assign a secure password"
                value={newAdmin.password}
                onChange={(e) => setNewAdmin({ ...newAdmin, password: e.target.value })}
                required
              />

              <div className="form-action-row">
                <Button variant="secondary" type="button" onClick={() => setActiveTab("users")}>
                  Cancel
                </Button>
                <Button variant="primary" type="submit" disabled={creatingAdmin}>
                  <Sparkles size={16} />
                  <span>{creatingAdmin ? "Creating Admin..." : "Create Admin Account"}</span>
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* Tab 3: Transaction & Audit Logs */}
        {activeTab === "logs" && (
          <div className="admin-card">
            <div className="card-header-row">
              <h3>System Transactions & Login History</h3>
              <p>Monitors session creations, IP addresses, and user devices.</p>
            </div>

            <div className="table-container">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Browser</th>
                    <th>OS</th>
                    <th>IP Address</th>
                    <th>Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.map((log) => (
                    <tr key={log._id}>
                      <td>
                        <div className="table-user-cell">
                          <strong>{log.user?.fullName || "User"}</strong>
                          <span className="user-cell-email">{log.user?.email || "N/A"}</span>
                        </div>
                      </td>
                      <td>{log.browser || "Chrome / Web"}</td>
                      <td>{log.operatingSystem || "Windows"}</td>
                      <td><code>{log.ipAddress || "127.0.0.1"}</code></td>
                      <td className="date-cell">
                        {new Date(log.createdAt || Date.now()).toLocaleString("en-IN")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {showAdminOtpModal && (
          <EmailOTPModal
            email={newAdmin.email}
            title="Verify New Admin Email 🔐"
            subtitle={`Enter the 6-digit verification code sent to ${newAdmin.email} to confirm Admin creation.`}
            onResend={() => requestCreateAdminOTP(newAdmin)}
            onVerify={(otp) => confirmCreateAdminOTP({ ...newAdmin, otp })}
            onClose={() => setShowAdminOtpModal(false)}
            onSuccess={() => {
              setNewAdmin({ fullName: "", email: "", password: "" });
              setActiveTab("users");
              loadAdminData();
            }}
          />
        )}
      </div>
    </DashboardLayout>
  );
};

export default AdminDashboard;
