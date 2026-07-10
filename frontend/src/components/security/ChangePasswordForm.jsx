import { useState } from "react";
import { toast } from "react-toastify";

import PasswordInput from "../ui/PasswordInput/PasswordInput";
import PasswordStrength from "../ui/PasswordStrength/PasswordStrength";
import Button from "../ui/Button/Button";

import { changePassword } from "../../services/authService";

const ChangePasswordForm = () => {
  const [formData, setFormData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.currentPassword) {
      newErrors.currentPassword =
        "Current password is required.";
    }

    if (!formData.newPassword) {
      newErrors.newPassword =
        "New password is required.";
    } else if (formData.newPassword.length < 8) {
      newErrors.newPassword =
        "Password must be at least 8 characters.";
    }

    if (
      formData.newPassword !==
      formData.confirmPassword
    ) {
      newErrors.confirmPassword =
        "Passwords do not match.";
    }

    if (
      formData.currentPassword &&
      formData.currentPassword ===
        formData.newPassword
    ) {
      newErrors.newPassword =
        "New password must be different from the current password.";
    }

    setErrors(newErrors);

    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      toast.error("Please fix the errors.");
      return;
    }

    try {
      setLoading(true);

      const response = await changePassword({
        currentPassword:
          formData.currentPassword,
        newPassword: formData.newPassword,
      });

      toast.success(response.message);

      setFormData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          "Failed to change password."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <h2>Change Password</h2>

      <form onSubmit={handleSubmit}>
        <PasswordInput
          label="Current Password"
          name="currentPassword"
          value={formData.currentPassword}
          onChange={handleChange}
          error={errors.currentPassword}
        />

        <PasswordInput
          label="New Password"
          name="newPassword"
          value={formData.newPassword}
          onChange={handleChange}
          error={errors.newPassword}
        />

        <PasswordStrength
          password={formData.newPassword}
        />

        <PasswordInput
          label="Confirm New Password"
          name="confirmPassword"
          value={formData.confirmPassword}
          onChange={handleChange}
          error={errors.confirmPassword}
        />

        <Button
          type="submit"
          loading={loading}
        >
          Change Password
        </Button>
      </form>
    </>
  );
};

export default ChangePasswordForm;