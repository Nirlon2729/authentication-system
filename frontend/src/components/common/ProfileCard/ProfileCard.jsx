import "./ProfileCard.css";

import { useAuth } from "../../../context/AuthContext";

const ProfileCard = () => {
  const { user } = useAuth();

  return (
    <div className="profile-card">

      <img
        src={
          user?.profilePicture ||
          `https://ui-avatars.com/api/?name=${user?.fullName}`
        }
        alt="Profile"
      />

      <h2>{user?.fullName}</h2>

      <p>{user?.email}</p>

      <div className="profile-info">

        <div>
          <span>Provider</span>
          <strong>{user?.provider}</strong>
        </div>

        <div>
          <span>Role</span>
          <strong>{user?.role}</strong>
        </div>

      </div>

    </div>
  );
};

export default ProfileCard;