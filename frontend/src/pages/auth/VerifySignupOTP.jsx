import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { ShieldCheck, ArrowRight } from "lucide-react";

import AuthLayout from "../../layouts/AuthLayout";
import OTPInput from "../../components/ui/OTPInput/OTPInput";
import Button from "../../components/ui/Button/Button";

import {
  verifyOTP,
  signupComplete,
  signupRequest,
} from "../../services/authService";

import { useAuth } from "../../context/AuthContext";

const VerifySignupOTP = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const { login } = useAuth();
  const formData = location.state?.formData;
  const email = formData?.email || "";

  useEffect(() => {
    if (!formData) {
      toast.error("Signup session expired. Please sign up again.");
      navigate("/signup", { replace: true });
    }
  }, [formData, navigate]);

  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [seconds, setSeconds] = useState(30);
  const [canResend, setCanResend] = useState(false);

  useEffect(() => {
    if (canResend) return;

    const timer = setInterval(() => {
      setSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setCanResend(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [canResend]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (loading) return;
    if (otp.length !== 6) {
      toast.error("Please enter a valid 6-digit OTP.");
      return;
    }

    try {
      setLoading(true);

      // Step 1: Verify OTP
      await verifyOTP({
        email,
        otp,
        type: "SIGNUP",
      });

      // Step 2: Create account
      const response = await signupComplete({
        email,
      });

      // Step 3: Login user
      login(response.user, response.token);

      toast.success("Account created and verified successfully 🎉");
      navigate("/dashboard");
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Signup verification failed."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    if (loading) return;
    try {
      setLoading(true);
      const response = await signupRequest(formData);

      toast.success(response.message || "Verification code sent.");
      setOtp("");
      setSeconds(30);
      setCanResend(false);
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Failed to resend code."
      );
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
            marginBottom: "0.75rem",
          }}
        >
          <ShieldCheck size={24} />
        </div>
        <h1 className="nirlon-title">Verify Email</h1>
        <p className="nirlon-subtitle" style={{ marginTop: "0.25rem" }}>
          Enter the 6-digit verification code sent to <strong>{email}</strong>
        </p>
      </div>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <OTPInput value={otp} onChange={(val) => setOtp(typeof val === "string" ? val : val.target.value)} />

        <Button type="submit" loading={loading} fullWidth>
          <span>Verify & Complete Registration</span>
          <ArrowRight size={18} />
        </Button>

        <div style={{ textAlign: "center", fontSize: "0.84rem" }}>
          {canResend ? (
            <button
              type="button"
              onClick={handleResendOTP}
              disabled={loading}
              style={{
                border: "none",
                background: "none",
                color: "var(--text-primary)",
                cursor: loading ? "not-allowed" : "pointer",
                fontWeight: "600",
              }}
            >
              Resend Code
            </button>
          ) : (
            <span style={{ color: "var(--text-muted)" }}>Resend code in {seconds}s</span>
          )}
        </div>
      </form>

      <div className="auth-footer">
        <Link to="/signup">Back to Sign Up</Link>
      </div>
    </AuthLayout>
  );
};

export default VerifySignupOTP;