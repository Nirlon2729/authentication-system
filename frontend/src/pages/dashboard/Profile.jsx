import { useEffect, useRef, useState } from "react";
import DashboardLayout from "../../layouts/DashboardLayout/DashboardLayout";
import { useAuth } from "../../context/AuthContext";
import {
  uploadAvatar,
  updateProfile,
  requestEmailVerifyOTP,
} from "../../services/profileService";
import {
  Camera,
  Mail,
  ShieldCheck,
  Smartphone,
  Calendar,
  Key,
  CheckCircle2,
  AlertCircle,
  UploadCloud,
  X,
  Sparkles,
} from "lucide-react";
import { toast } from "react-toastify";
import Input from "../../components/ui/Input/Input";
import Button from "../../components/ui/Button/Button";
import EmailOTPModal from "../../components/profile/EmailOTPModal";
import "../../styles/pages/profile.css";

const Profile = () => {
  const { user, loadUser, login } = useAuth();

  const fileInputRef = useRef(null);
  const [photoModalOpen, setPhotoModalOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);

  const [formData, setFormData] = useState({
    fullName: "",
    phone: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setFormData({
        fullName: user.fullName || "",
        phone: user.phone || "",
      });
    }
  }, [user]);

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select a valid image file (PNG, JPG, WEBP).");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image file size must be less than 5MB.");
      return;
    }

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleUploadPhoto = async () => {
    if (!selectedFile) {
      toast.error("Please select an image first.");
      return;
    }

    setUploadingPhoto(true);
    try {
      await uploadAvatar(selectedFile);
      await loadUser();
      setPhotoModalOpen(false);
      setSelectedFile(null);
      setPreviewUrl(null);
      toast.success("Profile picture updated successfully!");
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.message || "Failed to upload profile picture.");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.fullName.trim()) {
      toast.error("Full name cannot be empty.");
      return;
    }

    setSaving(true);
    try {
      await updateProfile({
        fullName: formData.fullName,
        phone: formData.phone,
      });
      await loadUser();
      toast.success("Profile updated successfully!");
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.message || "Failed to update profile.");
    } finally {
      setSaving(false);
    }
  };

  const handleRequestEmailVerify = async () => {
    if (!user?.email) return;
    try {
      await requestEmailVerifyOTP(user.email);
      setShowEmailModal(true);
      toast.info(`Verification code sent to ${user.email}`);
    } catch (err) {
      toast.error(err.message || "Failed to send verification code.");
    }
  };

  const handleEmailVerifySuccess = () => {
    if (user) {
      login({ ...user, isVerified: true }, localStorage.getItem("token"));
    }
    loadUser();
  };

  const isAdmin = user?.role === "admin" || user?.email === "nirlonmacwan27@gmail.com";

  return (
    <DashboardLayout>
      <div className="profile-page-wrapper">
        {/* =========================================
            1. Profile Header Hero Card
        ========================================= */}
        <section className="profile-hero-card">
          <div className="profile-hero-content">
            <div className="profile-avatar-container">
              <img
                src={
                  user?.profilePicture ||
                  `https://ui-avatars.com/api/?name=${encodeURIComponent(
                    user?.fullName || "User"
                  )}&background=8D0100&color=fff&bold=true`
                }
                alt={user?.fullName || "Profile"}
                className="profile-hero-avatar"
              />
              <button
                className="avatar-change-badge-btn"
                onClick={() => setPhotoModalOpen(true)}
                title="Change profile picture"
                aria-label="Change profile picture"
              >
                <Camera size={16} />
              </button>
            </div>

            <div className="profile-hero-details">
              <div className="profile-name-row">
                <h2 className="profile-hero-name">{user?.fullName || "Account User"}</h2>
                <span className={`profile-role-badge ${isAdmin ? "admin-badge" : "user-badge"}`}>
                  {isAdmin ? "Super Admin" : "Verified User"}
                </span>
              </div>

              <p className="profile-hero-email">{user?.email || "user@example.com"}</p>

              <div className="profile-hero-status-row">
                {user?.isVerified ? (
                  <span className="profile-verification-tag verified">
                    <CheckCircle2 size={14} />
                    <span>Email Verified</span>
                  </span>
                ) : (
                  <button
                    type="button"
                    className="profile-verification-tag unverified-clickable"
                    onClick={handleRequestEmailVerify}
                    title="Click to verify email"
                  >
                    <AlertCircle size={14} />
                    <span>Email Not Verified · Click to Verify</span>
                  </button>
                )}
                <span className="profile-provider-tag">
                  <Key size={13} />
                  <span>{user?.provider === "google" ? "Google OAuth" : "Local Password"}</span>
                </span>
              </div>
            </div>

            <div className="profile-hero-actions">
              <Button
                variant="secondary"
                onClick={() => setPhotoModalOpen(true)}
                className="change-photo-btn"
              >
                <Camera size={16} />
                <span>Change Photo</span>
              </Button>
            </div>
          </div>
        </section>

        {/* =========================================
            2. Two-Column Profile Grid
        ========================================= */}
        <div className="profile-grid">
          {/* LEFT: Personal Information Form */}
          <div className="profile-card personal-info-card">
            <div className="profile-card-header">
              <div>
                <h3 className="card-heading">Personal Information</h3>
                <p className="card-subheading">Manage your personal account information and credentials.</p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="personal-info-form">
              <Input
                label="Full Name"
                name="fullName"
                placeholder="Enter your full name"
                value={formData.fullName}
                onChange={handleChange}
                required
              />

              <div className="input-email-wrapper">
                <Input
                  label="Email Address"
                  type="email"
                  value={user?.email || ""}
                  disabled
                />
                {!user?.isVerified && (
                  <button
                    type="button"
                    className="email-inline-verify-btn"
                    onClick={handleRequestEmailVerify}
                  >
                    <Mail size={13} />
                    <span>Verify with OTP</span>
                  </button>
                )}
              </div>

              <Input
                label="Phone Number"
                name="phone"
                placeholder="e.g. 9876543210"
                value={formData.phone}
                onChange={handleChange}
              />

              <div className="form-submit-row">
                <Button type="submit" loading={saving} variant="primary">
                  <span>Save Profile Changes</span>
                </Button>
              </div>
            </form>
          </div>

          {/* RIGHT: Account & Verification Status Card */}
          <div className="profile-card account-status-card">
            <div className="profile-card-header">
              <div>
                <h3 className="card-heading">Account & Verification Status</h3>
                <p className="card-subheading">Overview of your identity credentials and security health.</p>
              </div>
            </div>

            <div className="status-rows-list">
              <div className="status-row-item">
                <div className="status-row-icon bg-red">
                  <Key size={16} />
                </div>
                <div className="status-row-info">
                  <span className="status-row-label">Authentication Provider</span>
                  <span className="status-row-val">
                    {user?.provider === "google" ? "Google Account (OAuth 2.0)" : "Local Email & Password"}
                  </span>
                </div>
              </div>

              <div className="status-row-item">
                <div className="status-row-icon bg-green">
                  <Mail size={16} />
                </div>
                <div className="status-row-info">
                  <span className="status-row-label">Email Verification</span>
                  <div className="status-badge-inline">
                    {user?.isVerified ? (
                      <span className="saas-badge success">
                        <CheckCircle2 size={12} /> Verified
                      </span>
                    ) : (
                      <span className="saas-badge warning">
                        <AlertCircle size={12} /> Pending OTP
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="status-row-item">
                <div className="status-row-icon bg-blue">
                  <Smartphone size={16} />
                </div>
                <div className="status-row-info">
                  <span className="status-row-label">Mobile Verification</span>
                  <div className="status-badge-inline">
                    <span className="saas-badge neutral">Not Configured</span>
                  </div>
                </div>
              </div>

              <div className="status-row-item">
                <div className="status-row-icon bg-purple">
                  <ShieldCheck size={16} />
                </div>
                <div className="status-row-info">
                  <span className="status-row-label">Account Status</span>
                  <div className="status-badge-inline">
                    <span className="saas-badge success">Active · Healthy 🟢</span>
                  </div>
                </div>
              </div>

              <div className="status-row-item">
                <div className="status-row-icon bg-amber">
                  <Calendar size={16} />
                </div>
                <div className="status-row-info">
                  <span className="status-row-label">Member Since</span>
                  <span className="status-row-val">
                    {user?.createdAt
                      ? new Date(user.createdAt).toLocaleDateString("en-US", {
                          month: "long",
                          day: "numeric",
                          year: "numeric",
                        })
                      : "Recently Registered"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* =========================================
            3. Change Photo Modal
        ========================================= */}
        {photoModalOpen && (
          <div className="saas-modal-backdrop" onClick={() => setPhotoModalOpen(false)}>
            <div className="saas-modal-dialog" onClick={(e) => e.stopPropagation()}>
              <div className="saas-modal-header">
                <div>
                  <h3 className="modal-title">Change Profile Picture</h3>
                  <p className="modal-subtitle">Upload a new photo to personalize your account</p>
                </div>
                <button
                  className="modal-close-icon-btn"
                  onClick={() => setPhotoModalOpen(false)}
                  aria-label="Close modal"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="saas-modal-body">
                <div className="photo-preview-center">
                  <img
                    src={
                      previewUrl ||
                      user?.profilePicture ||
                      `https://ui-avatars.com/api/?name=${encodeURIComponent(
                        user?.fullName || "User"
                      )}&background=8D0100&color=fff&bold=true`
                    }
                    alt="Preview"
                    className="modal-avatar-preview"
                  />
                </div>

                <div
                  className="dropzone-box"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <UploadCloud size={32} className="dropzone-icon" />
                  <p className="dropzone-text">
                    <strong>Click to browse</strong> or drag & drop image
                  </p>
                  <span className="dropzone-hint">Supported: JPG, PNG, WEBP (Max 5MB)</span>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  hidden
                />
              </div>

              <div className="saas-modal-footer">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setPhotoModalOpen(false);
                    setSelectedFile(null);
                    setPreviewUrl(null);
                  }}
                  type="button"
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onClick={handleUploadPhoto}
                  loading={uploadingPhoto}
                  disabled={!selectedFile || uploadingPhoto}
                >
                  <Sparkles size={16} />
                  <span>{uploadingPhoto ? "Uploading..." : "Save Photo"}</span>
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* =========================================
            4. Email OTP Verification Modal
        ========================================= */}
        {showEmailModal && (
          <EmailOTPModal
            email={user?.email}
            onClose={() => setShowEmailModal(false)}
            onSuccess={handleEmailVerifySuccess}
          />
        )}
      </div>
    </DashboardLayout>
  );
};

export default Profile;