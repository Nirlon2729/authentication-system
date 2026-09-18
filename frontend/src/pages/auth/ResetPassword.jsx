import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { KeyRound, CheckCircle2, ArrowRight } from "lucide-react";
import AuthLayout from "../../layouts/AuthLayout";
import Input from "../../components/ui/Input/Input";
import Button from "../../components/ui/Button/Button";
import { resetPassword } from "../../services/authService";

const ResetPassword = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const email = location.state?.email || "";
  const otpVerified = location.state?.otpVerified || false;

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    if (!email || !otpVerified) {
      toast.error("Unauthorized access.");
      navigate("/forgot-password");
    }
  }, [email, otpVerified, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!password) {
      toast.error("Password is required.");
      return;
    }

    if (password.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    try {
      setLoading(true);

      await resetPassword({
        email,
        password,
      });

      setIsSuccess(true);
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to reset password.");
    } finally {
      setLoading(false);
    }
  };

  // Validation Checks for Mockup Screen 6
  const hasMinLength = password.length >= 8;
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);

  if (isSuccess) {
    // Screen 7: Password Reset Success
    return (
      <AuthLayout>
        <div style={{ textAlign: "center", padding: "0.5rem 0" }}>
          <div 
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "50%",
              background: "#ecfdf5",
              color: "#10b981",
              border: "1px solid #a7f3d0",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: "1rem"
            }}
          >
            <CheckCircle2 size={32} />
          </div>

          <h1 className="nirlon-title">You&apos;re All Set!</h1>
          <p className="nirlon-subtitle" style={{ marginTop: "0.25rem", marginBottom: "1.5rem" }}>
            Your password has been reset successfully. You can now login with your new password.
          </p>

          <Button
            type="button"
            variant="primary"
            fullWidth
            onClick={() => navigate("/")}
          >
            <span>Go to Login</span>
            <ArrowRight size={18} />
          </Button>
        </div>
      </AuthLayout>
    );
  }

  // Screen 6: Reset Password
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
          <KeyRound size={24} />
        </div>
        <h1 className="nirlon-title">Reset Your Password</h1>
        <p className="nirlon-subtitle" style={{ marginTop: "0.25rem" }}>
          Create a new password for your account.
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <Input
          label="New Password"
          type="password"
          name="newPassword"
          id="newPassword"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Enter new password"
          autoComplete="new-password"
          required
        />

        <Input
          label="Confirm Password"
          type="password"
          name="confirmPassword"
          id="confirmPassword"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="Confirm new password"
          autoComplete="new-password"
          required
        />

        <div style={{ margin: "1rem 0", display: "flex", flexDirection: "column", gap: "0.4rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.82rem", color: hasMinLength ? "#10b981" : "var(--text-muted)", fontWeight: 600 }}>
            <CheckCircle2 size={14} /> <span>At least 8 characters</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.82rem", color: hasNumber ? "#10b981" : "var(--text-muted)", fontWeight: 600 }}>
            <CheckCircle2 size={14} /> <span>Include a number</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.82rem", color: hasSpecial ? "#10b981" : "var(--text-muted)", fontWeight: 600 }}>
            <CheckCircle2 size={14} /> <span>Include a special character</span>
          </div>
        </div>

        <Button type="submit" loading={loading} fullWidth>
          <span>Reset Password</span>
          <ArrowRight size={18} />
        </Button>
      </form>
    </AuthLayout>
  );
};

export default ResetPassword;