import { NavLink, useNavigate } from "react-router-dom";
import { LayoutDashboard, User, Settings, ShieldCheck, LogOut } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { toast } from "react-toastify";

const Sidebar = () => {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logout();
      toast.success("Logged out successfully");
      navigate("/");
    } catch (err) {
      console.error(err);
      toast.error("Logout failed");
    }
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-links">
        <NavLink to="/dashboard" className={({ isActive }) => `sidebar-link ${isActive ? "active" : ""}`}>
          <LayoutDashboard size={20} />
          <span>Dashboard</span>
        </NavLink>

        <NavLink to="/profile" className={({ isActive }) => `sidebar-link ${isActive ? "active" : ""}`}>
          <User size={20} />
          <span>Profile</span>
        </NavLink>

        <NavLink to="/settings" className={({ isActive }) => `sidebar-link ${isActive ? "active" : ""}`}>
          <Settings size={20} />
          <span>Settings</span>
        </NavLink>

        <NavLink to="/security" className={({ isActive }) => `sidebar-link ${isActive ? "active" : ""}`}>
          <ShieldCheck size={20} />
          <span>Security</span>
        </NavLink>
      </div>

      <button onClick={handleLogout} className="sidebar-logout-btn">
        <LogOut size={20} />
        <span>Logout</span>
      </button>
    </aside>
  );
};

export default Sidebar;