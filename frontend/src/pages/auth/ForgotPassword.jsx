import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { useAuth } from "../../context/AuthContext";
import AuthLayout from "../../layouts/AuthLayout";

import Input from "../../components/ui/Input/Input";
import Button from "../../components/ui/Button/Button";
import "../../styles/pages/forgot-password.css";
import { forgotPassword } from "../../services/authService";

const ForgotPassword = () => {
  const navigate = useNavigate();
const { user } = useAuth();
 const [email, setEmail] = useState(user?.email || "");
useEffect(() => {
  if (user?.email) {
    setEmail(user.email);
  }
}, [user]);
  const [loading, setLoading] = useState(false);

  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();

    setError("");

    if (!email.trim()) {
      setError("Email is required.");
      return;
    }

    try {
      setLoading(true);

      const response = await forgotPassword({
        email,
      });

      toast.success(
        response.message ||
          "OTP sent successfully."
      );

      navigate("/verify-otp", {
        state: {
          email,
        },
      });
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          "Failed to send OTP."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
  title="Forgot your password?"
  subtitle="Enter your email address and we'll send you a verification code."
>
      <form onSubmit={handleSubmit}>
        <Input
  label="Email"
  type="email"
  value={email}
  onChange={(e) => setEmail(e.target.value)}
  error={error}
  placeholder="Enter your email"
  disabled={!!user}
/>
{user && (
  <div className="info-message">
    🔒 We'll send the verification code to your registered email address.
  </div>
)}
        <Button
  type="submit"
  loading={loading}
  fullWidth
>
  Send Verification Code
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

export default ForgotPassword;