import { useAuth } from "../../context/AuthContext";
import { useNavigate } from "react-router-dom";

const Navbar = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="navbar">
      <h2>Auth Portal</h2>

      <div className="navbar-user" onClick={() => navigate("/profile")}>
        <img
          src={
            user?.profilePicture ||
            `https://ui-avatars.com/api/?name=${user?.fullName || "User"}&background=4f46e5&color=fff`
          }
          alt="Profile"
        />

        <span>{user?.fullName}</span>
      </div>
    </header>
  );
};

export default Navbar;