import { useState, useEffect } from "react";
import { toast } from "react-toastify";
import { ShieldCheck, Mail, KeyRound, CheckCircle2, ArrowRight } from "lucide-react";

import PasswordInput from "../ui/PasswordInput/PasswordInput";
import PasswordStrength from "../ui/PasswordStrength/PasswordStrength";
import Button from "../ui/Button/Button";
import OTPInput from "../ui/OTPInput/OTPInput";

import { changePassword, requestChangePasswordOTP, verifyOTP } from "../../services/authService";
import { useAuth } from "../../context/AuthContext";

const ChangePasswordForm = () => {
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [otp, setOtp] = useState("");

  const [seconds, setSeconds] = useState(30);
  const [canResend, setCanResend] = useState(false);

  const [formData, setFormData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (step !== 2 || canResend) return;

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
  }, [step, canResend]);

  const handleChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSendOTP = async () => {
    try {
      setLoading(true);
      const response = await requestChangePasswordOTP();
      toast.success(response.message || "Verification code sent to your email.");
      setStep(2);
      setSeconds(30);
      setCanResend(false);
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Failed to send verification code."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    try {
      setLoading(true);
      const response = await requestChangePasswordOTP();
      toast.success(response.message || "Verification code resent successfully.");
      setSeconds(30);
      setCanResend(false);
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Failed to resend verification code."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (otp.length !== 6) {
      toast.error("Please enter a valid 6-digit verification code.");
      return;
    }

    try {
      setLoading(true);
      const response = await verifyOTP({
        email: user.email,
        otp,
        type: "CHANGE_PASSWORD",
      });
      toast.success(response.message || "OTP verified successfully.");
      setStep(3);
    } catch (error) {
      toast.error(
        error.response?.data?.message || "OTP verification failed."
      );
    } finally {
      setLoading(false);
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.currentPassword) {
      newErrors.currentPassword = "Current password is required.";
    }

    if (!formData.newPassword) {
      newErrors.newPassword = "New password is required.";
    } else if (formData.newPassword.length < 8) {
      newErrors.newPassword = "Password must be at least 8 characters.";
    }

    if (formData.newPassword !== formData.confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match.";
    }

    if (
      formData.currentPassword &&
      formData.currentPassword === formData.newPassword
    ) {
      newErrors.newPassword = "New password must be different from the current password.";
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
        currentPassword: formData.currentPassword,
        newPassword: formData.newPassword,
        otp,
      });

      toast.success(response.message || "Password changed successfully 🎉");
      setFormData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      setOtp("");
      setStep(1);
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Failed to change password."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: "560px", margin: "0 auto" }}>
      {/* Step Header */}
      <div style={{ marginBottom: "1.75rem", textAlign: "center" }}>
        <h2
          style={{
            fontSize: "1.45rem",
            fontWeight: "800",
            color: "var(--text-primary)",
            margin: "0 0 0.35rem 0",
          }}
        >
          Change Account Password
        </h2>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.88rem", margin: "0 0 1.25rem 0" }}>
          For security purposes, we require identity verification before modifying your password.
        </p>

        {/* 3 Steps Progress Dots */}
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "0.6rem" }}>
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.4rem",
              }}
            >
              <span
                style={{
                  width: "28px",
                  height: "28px",
                  borderRadius: "50%",
                  background: step >= s ? "var(--crimson-main)" : "var(--bg-hover)",
                  color: step >= s ? "#ffffff" : "var(--text-muted)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "0.78rem",
                  fontWeight: "700",
                  border: `1px solid ${step >= s ? "var(--crimson-main)" : "var(--border-color)"}`,
                }}
              >
                {step > s ? <CheckCircle2 size={16} /> : s}
              </span>
              {s < 3 && (
                <div
                  style={{
                    width: "36px",
                    height: "2px",
                    background: step > s ? "var(--crimson-main)" : "var(--border-color)",
                  }}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ---------------- STEP 1: Request OTP ---------------- */}
      {step === 1 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          <div
            style={{
              padding: "1.25rem",
              background: "var(--bg-hover)",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--border-color)",
              display: "flex",
              alignItems: "center",
              gap: "1rem",
            }}
          >
            <Mail size={24} color="var(--primary-600)" />
            <div style={{ fontSize: "0.88rem", color: "var(--text-primary)" }}>
              We will send a 6-digit security code to <strong>{user?.email}</strong>.
            </div>
          </div>

          <Button loading={loading} onClick={handleSendOTP} fullWidth>
            <span>Send Verification Code</span>
            <ArrowRight size={16} />
          </Button>
        </div>
      )}

      {/* ---------------- STEP 2: Verify OTP ---------------- */}
      {step === 2 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          <p style={{ fontSize: "0.88rem", color: "var(--text-secondary)", textAlign: "center", margin: 0 }}>
            Enter the 6-digit verification code sent to <strong>{user?.email}</strong>.
          </p>

          <OTPInput value={otp} onChange={(e) => setOtp(e.target.value)} />

          <Button loading={loading} onClick={handleVerifyOTP} fullWidth>
            <span>Verify & Continue</span>
            <ArrowRight size={16} />
          </Button>

          <div style={{ textAlign: "center", fontSize: "0.85rem" }}>
            {canResend ? (
              <button
                type="button"
                onClick={handleResendOTP}
                style={{
                  border: "none",
                  background: "none",
                  color: "var(--primary-600)",
                  cursor: "pointer",
                  fontWeight: "700",
                }}
              >
                Resend Code
              </button>
            ) : (
              <span style={{ color: "var(--text-muted)" }}>Resend code in {seconds}s</span>
            )}
          </div>
        </div>
      )}

      {/* ---------------- STEP 3: Set New Password ---------------- */}
      {step === 3 && (
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.1rem" }}>
          <PasswordInput
            label="Current Password"
            name="currentPassword"
            value={formData.currentPassword}
            onChange={handleChange}
            error={errors.currentPassword}
            placeholder="Enter your current password"
          />

          <PasswordInput
            label="New Password"
            name="newPassword"
            value={formData.newPassword}
            onChange={handleChange}
            error={errors.newPassword}
            placeholder="Enter a strong new password"
          />

          <PasswordStrength password={formData.newPassword} />

          <PasswordInput
            label="Confirm New Password"
            name="confirmPassword"
            value={formData.confirmPassword}
            onChange={handleChange}
            error={errors.confirmPassword}
            placeholder="Re-type new password"
          />

          <Button type="submit" loading={loading} fullWidth>
            <span>Update Password</span>
          </Button>
        </form>
      )}
    </div>
  );
};

export default ChangePasswordForm;