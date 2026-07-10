import { useState } from "react";
import { toast } from "react-toastify";
import { Link } from "react-router-dom";

import AuthLayout from "../../layouts/AuthLayout";

import Input from "../../components/ui/Input/Input";
import PasswordInput from "../../components/ui/PasswordInput/PasswordInput";
import PasswordStrength from "../../components/ui/PasswordStrength/PasswordStrength";
import Button from "../../components/ui/Button/Button";
import { useNavigate } from "react-router-dom";
import { signupRequest } from "../../services/authService";

const Signup = () => {
  const [formData, setFormData] = useState({

    fullName: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const handleChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.fullName.trim()) {
      newErrors.fullName = "Full name is required.";
    }

    if (!formData.email.trim()) {
      newErrors.email = "Email is required.";
    } else if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)
    ) {
      newErrors.email = "Invalid email address.";
    }

    if (!formData.phone.trim()) {
      newErrors.phone = "Phone number is required.";
    } else if (!/^[0-9]{10}$/.test(formData.phone)) {
      newErrors.phone = "Phone number must be 10 digits.";
    }

    if (!formData.password) {
      newErrors.password = "Password is required.";
    } else if (formData.password.length < 8) {
      newErrors.password =
        "Password must be at least 8 characters.";
    }

    if (formData.confirmPassword !== formData.password) {
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

      const response = await signupRequest({
        fullName: formData.fullName,
        email: formData.email,
        phone: formData.phone,
        password: formData.password,
      });

      toast.success(
        response.message || "Account created successfully."
      );

      navigate("/verify-signup-otp", {
        state: {
          formData,
        },
      });
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
        "Signup failed."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Create Account"
      subtitle="Create your account to continue"
    >
      <form onSubmit={handleSubmit}>
        <Input
          label="Full Name"
          name="fullName"
          value={formData.fullName}
          onChange={handleChange}
          placeholder="Enter your full name"
          error={errors.fullName}
        />

        <Input
          label="Email"
          type="email"
          name="email"
          value={formData.email}
          onChange={handleChange}
          placeholder="Enter your email"
          error={errors.email}
        />

        <Input
          label="Phone Number"
          name="phone"
          value={formData.phone}
          onChange={handleChange}
          placeholder="Enter your phone number"
          error={errors.phone}
        />

        <PasswordInput
          label="Password"
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
        >
          Create Account
        </Button>
      </form>

      <div className="auth-footer">
        Already have an account?

        <br />

        <Link to="/">
          Login
        </Link>
      </div>
    </AuthLayout>
  );
};

export default Signup;