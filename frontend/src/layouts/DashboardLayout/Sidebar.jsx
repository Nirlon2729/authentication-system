import { NavLink } from "react-router-dom";

const Sidebar = () => {
  return (
    <aside className="sidebar">

      <NavLink to="/dashboard">
        Dashboard
      </NavLink>

      <NavLink to="/profile">
        Profile
      </NavLink>

      <NavLink to="/settings">
        Settings
      </NavLink>

      <NavLink to="/security">
        Security
      </NavLink>

    </aside>
  );
};

export default Sidebar;