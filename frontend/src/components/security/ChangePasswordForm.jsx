import { useState, useEffect } from "react";
import { toast } from "react-toastify";

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

      toast.success(response.message || "Password changed successfully.");
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
    <div style={{ marginTop: "20px" }}>
      <h2>Change Password</h2>
      <p style={{ color: "#6b7280", marginBottom: "20px" }}>
        Step {step} of 3
      </p>

      {/* ---------------- STEP 1 ---------------- */}
      {step === 1 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
          <p>
            To change your password, we need to send a 6-digit verification code to your registered email: <strong>{user?.email}</strong>.
          </p>
          <Button loading={loading} onClick={handleSendOTP}>
            Send Verification Code
          </Button>
        </div>
      )}

      {/* ---------------- STEP 2 ---------------- */}
      {step === 2 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
          <p>Check your inbox and enter the 6-digit verification code below.</p>
          <OTPInput value={otp} onChange={(e) => setOtp(e.target.value)} />
          <Button loading={loading} onClick={handleVerifyOTP}>
            Verify Code
          </Button>
          <div style={{ textAlign: "center", marginTop: "10px" }}>
            {canResend ? (
              <button
                type="button"
                onClick={handleResendOTP}
                style={{
                  border: "none",
                  background: "none",
                  color: "#2563eb",
                  cursor: "pointer",
                  fontWeight: "600",
                }}
              >
                Resend OTP
              </button>
            ) : (
              <p style={{ color: "#6b7280" }}>Resend OTP in {seconds}s</p>
            )}
          </div>
        </div>
      )}

      {/* ---------------- STEP 3 ---------------- */}
      {step === 3 && (
        <form onSubmit={handleSubmit}>
          <PasswordInput
            label="Current Password"
            name="currentPassword"
            value={formData.currentPassword}
            onChange={handleChange}
            error={errors.currentPassword}
          />

          <PasswordInput
            label="New Password"
            name="newPassword"
            value={formData.newPassword}
            onChange={handleChange}
            error={errors.newPassword}
          />

          <PasswordStrength password={formData.newPassword} />

          <PasswordInput
            label="Confirm New Password"
            name="confirmPassword"
            value={formData.confirmPassword}
            onChange={handleChange}
            error={errors.confirmPassword}
          />

          <Button type="submit" loading={loading}>
            Change Password
          </Button>
        </form>
      )}
    </div>
  );
};

export default ChangePasswordForm;