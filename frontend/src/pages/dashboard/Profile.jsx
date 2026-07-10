import { useEffect, useRef, useState } from "react";
import ImageCropModal from "../../components/profile/ImageCropModal";
import { useAuth } from "../../context/AuthContext";
import "../../styles/pages/profile.css";
import { Camera } from "lucide-react";
import {
  uploadAvatar,
  updateProfile,
} from "../../services/profileService";
import { toast } from "react-toastify";
import Input from "../../components/ui/Input/Input";
import Button from "../../components/ui/Button/Button";

const Profile = () => {
  const { user, loadUser } = useAuth();

  const fileInputRef = useRef(null);
  const [selectedImage, setSelectedImage] =
    useState(null);

  const [showCropper, setShowCropper] =
    useState(false);

  const [formData, setFormData] = useState({
    fullName: "",
    phone: "",
  });

  useEffect(() => {
    if (user) {
      setFormData({
        fullName: user.fullName || "",
        phone: user.phone || "",
      });
    }
  }, [user]);

  const handleChooseImage = () => {
    fileInputRef.current.click();
  };

  const handleUpload = (e) => {
    const file = e.target.files[0];

    if (!file) return;

    const imageUrl =
      URL.createObjectURL(file);

    setSelectedImage(imageUrl);

    setShowCropper(true);
  };
  const handleCropUpload = async (
    croppedBlob
  ) => {
    try {
      const file = new File(
        [croppedBlob],
        "avatar.jpg",
        {
          type: "image/jpeg",
        }
      );

      await uploadAvatar(file);

      await loadUser();

      setShowCropper(false);

      setSelectedImage(null);

      alert("Profile picture updated successfully.");
    } catch (error) {
      console.error(error);

      alert(
        error.response?.data?.message ||
        "Upload failed."
      );
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      await updateProfile({
        fullName: formData.fullName,
        phone: formData.phone,
      });

      await loadUser();

      toast.success("Profile updated successfully.");
    } catch (error) {
      console.error(error);

      alert(
        error.response?.data?.message ||
        "Profile update failed."
      );
    }
  };

  return (
    <div className="profile-page">
      <div className="profile-card">

        <h1 className="profile-title">
          My Profile
        </h1>

        <div className="profile-header">

          <div
            className="avatar-wrapper"
            onClick={handleChooseImage}
          >
            <img
              className="profile-avatar"
              src={
                user?.profilePicture ||
                `https://ui-avatars.com/api/?name=${encodeURIComponent(
                  user?.fullName
                )}`
              }
              alt="Profile"
            />

            <div className="avatar-overlay">
              <Camera size={34} />
            </div>
          </div>

          <h2 className="profile-name">
            {user?.fullName}
          </h2>

          <p className="profile-email">
            {user?.email}
          </p>

          <div
  className={`profile-badge ${
    user?.isVerified
      ? ""
      : "profile-badge-warning"
  }`}
>
  {user?.isVerified
    ? "✅ Verified Account"
    : "⚠️ Email Not Verified"}
</div>

          <Button
            variant="secondary"
            onClick={handleChooseImage}
          >
            Change Profile Picture
          </Button>

          <input
            hidden
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleUpload}
          />

        </div>

        <div className="profile-divider" />

        <section>

          <h2 className="section-title">
            👤 Personal Information
          </h2>

          <form
            className="profile-form"
            onSubmit={handleSubmit}
          >

            <Input
              label="Full Name"
              name="fullName"
              value={formData.fullName}
              onChange={handleChange}
              placeholder="Enter your full name"
            />

            <Input
              label="Email"
              type="email"
              value={user?.email || ""}
              disabled
            />

            <Input
              label="Phone Number"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              placeholder="Enter your phone number"
            />

            <div className="profile-save">

              <Button
                type="submit"
                fullWidth
              >
                Save Changes
              </Button>

            </div>

          </form>

        </section>

        <div className="profile-divider" />

        <section>

  <h2 className="section-title">
    📋 Account Information
  </h2>

  <div className="account-grid">

    <div className="account-item">
      <p className="account-label">
        Provider
      </p>

      <p className="account-value">
        {user?.provider === "google"
          ? "Google"
          : "Local"}
      </p>
    </div>

    <div className="account-item">
      <p className="account-label">
        Role
      </p>

      <p className="account-value">
        {user?.role}
      </p>
    </div>

    <div className="account-item">
      <p className="account-label">
        Email Status
      </p>

      <p
        className={`account-value ${
          user?.isVerified
            ? "status-verified"
            : "status-unverified"
        }`}
      >
        {user?.isVerified
          ? "Verified ✅"
          : "Not Verified ❌"}
      </p>
    </div>

    <div className="account-item">
      <p className="account-label">
        Member Since
      </p>

      <p className="account-value">
        {user?.createdAt
          ? new Date(
              user.createdAt
            ).toLocaleDateString("en-IN", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })
          : "-"}
      </p>
    </div>

  </div>

</section>

      </div>

      {showCropper && (
        <ImageCropModal
          image={selectedImage}
          onCancel={() => {
            setShowCropper(false);
            setSelectedImage(null);
          }}
          onSave={handleCropUpload}
        />
      )}
    </div>
  );
};

export default Profile;