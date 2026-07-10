import "./AccountCard.css";

import { useAuth } from "../../../context/AuthContext";

const AccountCard = () => {
  const { user } = useAuth();

  return (
    <div className="account-card">
      <h2>Account Information</h2>

      <div className="info-row">
        <span>Provider</span>
        <strong>{user?.provider}</strong>
      </div>

      <div className="info-row">
        <span>Role</span>
        <strong>{user?.role}</strong>
      </div>

      <div className="info-row">
        <span>Email Verified</span>
        <strong>{user?.isVerified ? "Yes" : "No"}</strong>
      </div>

      <div className="info-row">
        <span>Account Status</span>
        <strong>{user?.isBlocked ? "Blocked" : "Active"}</strong>
      </div>

      <div className="info-row">
        <span>Created</span>
        <strong>
          {user?.createdAt
            ? new Date(user.createdAt).toLocaleDateString()
            : "-"}
        </strong>
      </div>

      <div className="info-row">
        <span>Last Login</span>
        <strong>
          {user?.lastLogin
            ? new Date(user.lastLogin).toLocaleString()
            : "-"}
        </strong>
      </div>
    </div>
  );
};

export default AccountCard;