import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { Mail, ArrowRight } from "lucide-react";
import AuthLayout from "../../layouts/AuthLayout";
import Input from "../../components/ui/Input/Input";
import Button from "../../components/ui/Button/Button";
import { forgotPassword } from "../../services/authService";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!email.trim()) {
      toast.error("Email is required.");
      return;
    }

    try {
      setLoading(true);

      const response = await forgotPassword(email);

      toast.success(response.message || "OTP code sent to your email.");

      navigate("/verify-otp", {
        state: { email },
      });
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to send reset code.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <div style={{ textAlign: "center", marginBottom: "1.25rem" }}>
        <div 
          style={{
            width: "48px",
            height: "48px",
            borderRadius: "var(--radius-md)",
            background: "var(--bg-subtle)",
            color: "var(--text-primary)",
            border: "1px solid var(--border-color)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: "0.75rem"
          }}
        >
          <Mail size={24} />
        </div>
        <h1 className="nirlon-title">Forgot Password?</h1>
        <p className="nirlon-subtitle" style={{ marginTop: "0.25rem" }}>
          No worries! Enter your email and we&apos;ll send you instructions to reset your password.
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <Input
          label="Email Address"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Enter your email"
          required
        />

        <Button type="submit" loading={loading} fullWidth>
          <span>Send Reset Link</span>
          <ArrowRight size={18} />
        </Button>
      </form>

      <div className="auth-footer">
        <p>Remembered your password?</p>
        <Link to="/">Login</Link>
      </div>
    </AuthLayout>
  );
};

export default ForgotPassword;