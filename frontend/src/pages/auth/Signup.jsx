import { useState } from "react";
import { toast } from "react-toastify";
import { Link, useNavigate } from "react-router-dom";
import { User, Mail, Phone, Lock, ArrowRight } from "lucide-react";

import AuthLayout from "../../layouts/AuthLayout";
import Input from "../../components/ui/Input/Input";
import PasswordStrength from "../../components/ui/PasswordStrength/PasswordStrength";
import Checkbox from "../../components/ui/Checkbox/Checkbox";
import Button from "../../components/ui/Button/Button";
import { signupRequest } from "../../services/authService";

const Signup = () => {
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    agreeToTerms: true,
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.fullName.trim()) {
      newErrors.fullName = "Full name is required.";
    }

    if (!formData.email.trim()) {
      newErrors.email = "Email is required.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
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
      newErrors.password = "Password must be at least 8 characters.";
    }

    if (formData.confirmPassword !== formData.password) {
      newErrors.confirmPassword = "Passwords do not match.";
    }

    if (!formData.agreeToTerms) {
      newErrors.agreeToTerms = "You must agree to the terms & conditions.";
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

      toast.success(response.message || "Account created successfully.");

      navigate("/verify-signup-otp", {
        state: { formData },
      });
    } catch (error) {
      const apiErrors = error.response?.data?.errors;
      const errorMsg = apiErrors && Array.isArray(apiErrors)
        ? apiErrors.map((err) => err.msg).join(" ")
        : error.response?.data?.message || "Signup failed.";
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Create Your Account"
      subtitle="Join us today! Create your account."
    >
      <form onSubmit={handleSubmit}>
        <Input
          label="Full Name"
          name="fullName"
          value={formData.fullName}
          onChange={handleChange}
          placeholder="Enter your full name"
          error={errors.fullName}
          icon={<User size={18} />}
        />

        <Input
          label="Email Address"
          type="email"
          name="email"
          value={formData.email}
          onChange={handleChange}
          placeholder="Enter your email"
          error={errors.email}
          icon={<Mail size={18} />}
        />

        <Input
          label="Phone Number"
          name="phone"
          value={formData.phone}
          onChange={handleChange}
          placeholder="Enter your phone number"
          error={errors.phone}
          icon={<Phone size={18} />}
        />

        <Input
          label="Password"
          type="password"
          name="password"
          value={formData.password}
          onChange={handleChange}
          placeholder="Create a password"
          error={errors.password}
          icon={<Lock size={18} />}
        />

        <PasswordStrength password={formData.password} />

        <Input
          label="Confirm Password"
          type="password"
          name="confirmPassword"
          value={formData.confirmPassword}
          onChange={handleChange}
          placeholder="Confirm your password"
          error={errors.confirmPassword}
          icon={<Lock size={18} />}
        />

        <div style={{ margin: "1rem 0" }}>
          <Checkbox
            name="agreeToTerms"
            checked={formData.agreeToTerms}
            onChange={handleChange}
            label={
              <span>
                I agree to the <a href="#terms" style={{ color: "var(--text-primary)", fontWeight: 600 }}>Terms & Conditions</a> and <a href="#privacy" style={{ color: "var(--text-primary)", fontWeight: 600 }}>Privacy Policy</a>
              </span>
            }
          />
          {errors.agreeToTerms && (
            <p style={{ color: "var(--danger)", fontSize: "0.8rem", marginTop: "0.3rem", fontWeight: 500 }}>
              {errors.agreeToTerms}
            </p>
          )}
        </div>

        <Button type="submit" loading={loading} fullWidth>
          <span>Create Account</span>
          <ArrowRight size={18} />
        </Button>
      </form>

      <div className="auth-footer">
        <p>Already have an account?</p>
        <Link to="/">Login</Link>
      </div>
    </AuthLayout>
  );
};

export default Signup;