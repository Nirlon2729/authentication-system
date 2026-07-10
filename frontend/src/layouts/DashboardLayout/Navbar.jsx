import { useAuth } from "../../context/AuthContext";

const Navbar = () => {
  const { user } = useAuth();

  return (
    <header className="navbar">
      <h2>Authentication System</h2>

      <div className="navbar-user">
        <img
          src={
            user?.profilePicture ||
            "https://ui-avatars.com/api/?name=User"
          }
          alt="Profile"
        />

        <span>{user?.fullName}</span>
      </div>
    </header>
  );
};

export default Navbar;