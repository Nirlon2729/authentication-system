import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

import AuthLayout from "../../layouts/AuthLayout";

import PasswordInput from "../../components/ui/PasswordInput/PasswordInput";
import PasswordStrength from "../../components/ui/PasswordStrength/PasswordStrength";
import Button from "../../components/ui/Button/Button";

import { resetPassword } from "../../services/authService";

const ResetPassword = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const email = location.state?.email || "";
  const otp = location.state?.otp || "";

  const [formData, setFormData] = useState({
    password: "",
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

  // Password validation
  if (!formData.password.trim()) {
    newErrors.password = "Password is required.";
  } else if (formData.password.length < 8) {
    newErrors.password =
      "Password must be at least 8 characters.";
  } else if (
    !/(?=.*[a-z])/.test(formData.password)
  ) {
    newErrors.password =
      "Password must contain at least one lowercase letter.";
  } else if (
    !/(?=.*[A-Z])/.test(formData.password)
  ) {
    newErrors.password =
      "Password must contain at least one uppercase letter.";
  } else if (
    !/(?=.*\d)/.test(formData.password)
  ) {
    newErrors.password =
      "Password must contain at least one number.";
  } else if (
    !/(?=.*[@$!%*?&])/.test(formData.password)
  ) {
    newErrors.password =
      "Password must contain at least one special character.";
  }

  // Confirm Password validation
  if (!formData.confirmPassword.trim()) {
    newErrors.confirmPassword =
      "Please confirm your password.";
  } else if (
    formData.confirmPassword !== formData.password
  ) {
    newErrors.confirmPassword =
      "Passwords do not match.";
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

      const response = await resetPassword({
        email,
        otp,
        password: formData.password,
      });

      toast.success(
        response.message ||
          "Password reset successfully."
      );

      navigate("/");
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          "Failed to reset password."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
  title="Create a New Password 🔐"
  subtitle="Choose a strong password that you haven't used before."
>
      <form onSubmit={handleSubmit}>
        <PasswordInput
          label="New Password"
          name="password"
          value={formData.password}
          onChange={handleChange}
          error={errors.password}
        />

        <PasswordStrength
          password={formData.password}
        />

        <PasswordInput
          label="Confirm Password"
          name="confirmPassword"
          value={formData.confirmPassword}
          onChange={handleChange}
          error={errors.confirmPassword}
        />

        <Button
  type="submit"
  loading={loading}
  fullWidth
>
  Update Password
</Button>
      </form>

      <div className="auth-footer">
        <Link to="/">
          Back to Login
        </Link>
      </div>
    </AuthLayout>
  );
};

export default ResetPassword;