import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { ShieldCheck, ArrowRight, Mail, Smartphone } from "lucide-react";
import AuthLayout from "../../layouts/AuthLayout";
import OTPInput from "../../components/ui/OTPInput/OTPInput";
import Button from "../../components/ui/Button/Button";
import { verifyOTPController, resendOTP } from "../../services/authService";

const VerifyOTP = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const email = location.state?.email || "";
  const [otp, setOtp] = useState("");
  const [timer, setTimer] = useState(30);
  const [loading, setLoading] = useState(false);
  const [deliveryMethod, setDeliveryMethod] = useState("email");

  useEffect(() => {
    if (!email) {
      toast.error("Invalid access. Please enter your email.");
      navigate("/forgot-password");
      return;
    }

    const interval = setInterval(() => {
      setTimer((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(interval);
  }, [email, navigate]);

  const handleVerify = async (e) => {
    e.preventDefault();

    if (!otp || otp.length !== 6) {
      toast.error("Please enter the complete 6-digit OTP code.");
      return;
    }

    try {
      setLoading(true);

      await verifyOTPController({
        email,
        otp,
        type: "PASSWORD_RESET",
      });

      toast.success("OTP verified successfully 🎉");

      navigate("/reset-password", {
        state: { email, otpVerified: true },
      });
    } catch (error) {
      toast.error(error.response?.data?.message || "Invalid or expired OTP code.");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (timer > 0) return;

    try {
      await resendOTP(email, "PASSWORD_RESET");
      toast.success(`Verification code sent to ${email}`);
      setTimer(30);
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to resend code.");
    }
  };

  const formatTimer = () => {
    const mins = Math.floor(timer / 60);
    const secs = timer % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
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
          <ShieldCheck size={24} />
        </div>
        <h1 className="nirlon-title">Verify OTP</h1>
        <p className="nirlon-subtitle" style={{ marginTop: "0.25rem" }}>
          We&apos;ve sent a 6-digit code to <strong>{email || "your email"}</strong>
        </p>
      </div>

      <form onSubmit={handleVerify}>
        <div className="otp-input-section">
          <OTPInput value={otp} onChange={setOtp} />
        </div>

        <div style={{ textAlign: "center", margin: "1rem 0", fontSize: "0.84rem", color: "var(--text-muted)" }}>
          Didn&apos;t receive the code?{" "}
          <button
            type="button"
            onClick={handleResend}
            disabled={timer > 0}
            style={{
              background: "none",
              border: "none",
              color: timer > 0 ? "var(--text-muted)" : "var(--text-primary)",
              fontWeight: 600,
              cursor: timer > 0 ? "not-allowed" : "pointer"
            }}
          >
            Resend {timer > 0 && `(${formatTimer()})`}
          </button>
        </div>

        <Button type="submit" loading={loading} fullWidth>
          <span>Verify & Continue</span>
          <ArrowRight size={18} />
        </Button>
      </form>

      <div style={{ marginTop: "1.25rem", paddingTop: "1rem", borderTop: "1px solid var(--border-color)", textAlign: "center" }}>
        <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "0.5rem", fontWeight: 500 }}>
          Delivery method
        </p>
        <div style={{ display: "flex", justifyContent: "center", gap: "0.75rem" }}>
          <button
            type="button"
            onClick={() => setDeliveryMethod("email")}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.35rem",
              padding: "0.35rem 0.75rem",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--border-color)",
              background: deliveryMethod === "email" ? "var(--color-primary)" : "var(--bg-card)",
              color: deliveryMethod === "email" ? "#ffffff" : "var(--text-secondary)",
              fontSize: "0.8rem",
              fontWeight: 500,
              cursor: "pointer"
            }}
          >
            <Mail size={14} /> <span>Email</span>
          </button>

          <button
            type="button"
            onClick={() => setDeliveryMethod("sms")}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.35rem",
              padding: "0.35rem 0.75rem",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--border-color)",
              background: deliveryMethod === "sms" ? "var(--color-primary)" : "var(--bg-card)",
              color: deliveryMethod === "sms" ? "#ffffff" : "var(--text-secondary)",
              fontSize: "0.8rem",
              fontWeight: 500,
              cursor: "pointer"
            }}
          >
            <Smartphone size={14} /> <span>SMS</span>
          </button>
        </div>
      </div>
    </AuthLayout>
  );
};

export default VerifyOTP;