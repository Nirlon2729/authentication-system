import { useState, useEffect } from "react";
import { toast } from "react-toastify";
import { Mail, CheckCircle2, ArrowRight, ShieldAlert, KeyRound } from "lucide-react";

import PasswordInput from "../ui/PasswordInput/PasswordInput";
import PasswordStrength from "../ui/PasswordStrength/PasswordStrength";
import Button from "../ui/Button/Button";
import OTPInput from "../ui/OTPInput/OTPInput";

import {
  changePassword,
  requestChangePasswordOTP,
  verifyChangePasswordOTP,
  verifyOTP,
} from "../../services/authService";
import { useAuth } from "../../context/AuthContext";

const maskEmail = (email) => {
  if (!email || !email.includes("@")) return "";
  const [local, domain] = email.split("@");
  if (local.length <= 2) return `${local[0]}***@${domain}`;
  return `${local.slice(0, 2)}${"*".repeat(Math.max(3, local.length - 3))}${local.slice(-1)}@${domain}`;
};

const ChangePasswordForm = () => {
  const { user, loadUser } = useAuth();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [otp, setOtp] = useState("");
  const [resetToken, setResetToken] = useState(null);

  const [seconds, setSeconds] = useState(30);
  const [canResend, setCanResend] = useState(false);

  const isSettingPassword = !user?.hasPassword;

  const [formData, setFormData] = useState({
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
    if (errors[e.target.name]) {
      setErrors((prev) => ({ ...prev, [e.target.name]: "" }));
    }
  };

  const handleSendOTP = async () => {
    if (!user?.isVerified) {
      toast.error("Please verify your email address before setting or changing your password.");
      return;
    }

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
    const cleanOtp = (typeof otp === "string" ? otp : "").trim();
    if (cleanOtp.length !== 6) {
      toast.error("Please enter a valid 6-digit verification code.");
      return;
    }

    try {
      setLoading(true);
      let response;
      try {
        response = await verifyChangePasswordOTP({ otp: cleanOtp });
      } catch (profileErr) {
        // Fallback to auth verify-otp endpoint if profile route fails
        response = await verifyOTP({
          email: user.email,
          otp: cleanOtp,
          type: "CHANGE_PASSWORD",
        });
      }

      if (response.resetToken) {
        setResetToken(response.resetToken);
      }
      toast.success(response.message || "Code verified successfully.");
      setStep(3);
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Verification code is invalid or has expired."
      );
    } finally {
      setLoading(false);
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.newPassword) {
      newErrors.newPassword = "Password is required.";
    } else if (formData.newPassword.length < 8) {
      newErrors.newPassword = "Password must be at least 8 characters.";
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = "Confirm password is required.";
    } else if (formData.newPassword !== formData.confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match.";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      toast.error("Please correct the errors in the form.");
      return;
    }

    try {
      setLoading(true);

      const response = await changePassword({
        newPassword: formData.newPassword,
        confirmPassword: formData.confirmPassword,
        resetToken,
        otp,
      });

      toast.success(
        response.message ||
          (isSettingPassword
            ? "Password created successfully! You can now sign in with email and password."
            : "Password updated successfully 🎉")
      );

      // Refresh user in auth context to update hasPassword state
      if (typeof loadUser === "function") {
        await loadUser();
      }

      setFormData({
        newPassword: "",
        confirmPassword: "",
      });
      setOtp("");
      setResetToken(null);
      setStep(1);
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Failed to update password."
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
          {isSettingPassword ? "Create Account Password" : "Change Account Password"}
        </h2>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.88rem", margin: "0 0 1.25rem 0" }}>
          {isSettingPassword
            ? "Set up a password to enable email & password sign-in alongside your Google account."
            : "For security purposes, we require identity verification via email before modifying your password."}
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
                  background: step >= s ? "var(--primary-600)" : "var(--bg-hover)",
                  color: step >= s ? "#ffffff" : "var(--text-muted)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "0.78rem",
                  fontWeight: "700",
                  border: `1px solid ${step >= s ? "var(--primary-600)" : "var(--border-color)"}`,
                }}
              >
                {step > s ? <CheckCircle2 size={16} /> : s}
              </span>
              {s < 3 && (
                <div
                  style={{
                    width: "36px",
                    height: "2px",
                    background: step > s ? "var(--primary-600)" : "var(--border-color)",
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
          {!user?.isVerified ? (
            <div
              style={{
                padding: "1.25rem",
                background: "rgba(239, 68, 68, 0.08)",
                borderRadius: "var(--radius-md)",
                border: "1px solid rgba(239, 68, 68, 0.3)",
                display: "flex",
                alignItems: "center",
                gap: "1rem",
              }}
            >
              <ShieldAlert size={24} color="#ef4444" />
              <div style={{ fontSize: "0.88rem", color: "var(--text-primary)" }}>
                Your email address <strong>{user?.email}</strong> is unverified. Please verify your email address in the Change Email section before setting or changing your password.
              </div>
            </div>
          ) : (
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
                We will send a 6-digit security verification code to your verified email address:{" "}
                <strong>{maskEmail(user?.email)}</strong>.
              </div>
            </div>
          )}

          <Button
            loading={loading}
            disabled={!user?.isVerified}
            onClick={handleSendOTP}
            fullWidth
          >
            <span>Send Verification Code</span>
            <ArrowRight size={16} />
          </Button>
        </div>
      )}

      {/* ---------------- STEP 2: Verify OTP ---------------- */}
      {step === 2 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          <p style={{ fontSize: "0.88rem", color: "var(--text-secondary)", textAlign: "center", margin: 0 }}>
            Enter the 6-digit verification code sent to <strong>{maskEmail(user?.email)}</strong>.
          </p>

          <OTPInput
            value={otp}
            onChange={(val) => setOtp(typeof val === "string" ? val : (val?.target?.value ?? ""))}
          />

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
            label={isSettingPassword ? "New Password" : "New Password"}
            name="newPassword"
            value={formData.newPassword}
            onChange={handleChange}
            error={errors.newPassword}
            placeholder={isSettingPassword ? "Create a strong password" : "Enter a strong new password"}
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
            <KeyRound size={16} />
            <span>{isSettingPassword ? "Set Password" : "Change Password"}</span>
          </Button>
        </form>
      )}
    </div>
  );
};

export default ChangePasswordForm;