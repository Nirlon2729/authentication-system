import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { KeyRound, Mail, CheckCircle2, ArrowRight } from "lucide-react";

import "./CreatePasswordWizard.css";

import Button from "../ui/Button/Button";
import OTPInput from "../ui/OTPInput/OTPInput";
import PasswordInput from "../ui/PasswordInput/PasswordInput";
import PasswordStrength from "../ui/PasswordStrength/PasswordStrength";

import {
  requestCreatePasswordOTP,
  verifyOTP,
  createPassword,
} from "../../services/authService";

import { useAuth } from "../../context/AuthContext";

const CreatePasswordWizard = () => {
  const { user, loadUser } = useAuth();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [seconds, setSeconds] = useState(30);
  const [canResend, setCanResend] = useState(false);
  const [otp, setOtp] = useState("");

  const [passwordData, setPasswordData] = useState({
    password: "",
    confirmPassword: "",
  });

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

  const handlePasswordChange = (e) => {
    setPasswordData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSendOTP = async () => {
    try {
      setLoading(true);
      const response = await requestCreatePasswordOTP();
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
        type: "CREATE_PASSWORD",
      });
      toast.success(response.message || "Email verified successfully.");
      setStep(3);
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Verification failed."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    try {
      setLoading(true);
      const response = await requestCreatePasswordOTP();
      toast.success(response.message || "Verification code resent.");
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

  const handleCreatePassword = async () => {
    if (!passwordData.password) {
      toast.error("Password is required.");
      return;
    }

    if (passwordData.password.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }

    if (passwordData.password !== passwordData.confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    try {
      setLoading(true);
      const response = await createPassword({
        password: passwordData.password,
      });

      toast.success(response.message || "Password created successfully 🎉");
      await loadUser();
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Failed to create password."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="create-password-wizard-container">
      <div className="wizard-header">
        <div className="wizard-icon-box">
          <KeyRound size={28} />
        </div>
        <h2>Create Account Password</h2>
        <p>
          Add a password to your account so you can sign in with your email directly as well as Google OAuth.
        </p>

        <div className="wizard-email-card">
          <span className="email-label">Account Email</span>
          <strong className="email-val">{user?.email}</strong>
        </div>

        {/* 3 Steps Progress Indicator */}
        <div className="wizard-step-tracker">
          {[1, 2, 3].map((s) => (
            <div key={s} className="step-track-item">
              <span className={`step-dot ${step >= s ? "active" : ""}`}>
                {step > s ? <CheckCircle2 size={16} /> : s}
              </span>
              {s < 3 && <div className={`step-bar ${step > s ? "active" : ""}`} />}
            </div>
          ))}
        </div>
      </div>

      {/* ---------------- STEP 1: Send OTP ---------------- */}
      {step === 1 && (
        <div className="wizard-step-content">
          <div className="wizard-info-box">
            <Mail size={22} />
            <p>
              We will send a 6-digit verification code to <strong>{user?.email}</strong> to ensure account ownership.
            </p>
          </div>
          <Button loading={loading} onClick={handleSendOTP} fullWidth>
            <span>Send Verification Code</span>
            <ArrowRight size={16} />
          </Button>
        </div>
      )}

      {/* ---------------- STEP 2: Verify Code ---------------- */}
      {step === 2 && (
        <div className="wizard-step-content">
          <p className="wizard-step-desc">
            Check your email inbox and enter the 6-digit verification code below.
          </p>

          <OTPInput value={otp} onChange={(e) => setOtp(e.target.value)} />

          <Button loading={loading} onClick={handleVerifyOTP} fullWidth>
            <span>Verify & Proceed</span>
            <ArrowRight size={16} />
          </Button>

          <div className="wizard-resend-row">
            {canResend ? (
              <button
                type="button"
                className="resend-link-btn"
                onClick={handleResendOTP}
              >
                Resend Code
              </button>
            ) : (
              <span className="resend-timer-text">
                Resend code in {seconds}s
              </span>
            )}
          </div>
        </div>
      )}

      {/* ---------------- STEP 3: Set Password ---------------- */}
      {step === 3 && (
        <div className="wizard-step-content">
          <PasswordInput
            label="New Password"
            name="password"
            value={passwordData.password}
            onChange={handlePasswordChange}
            placeholder="Create a strong password"
          />

          <PasswordStrength password={passwordData.password} />

          <PasswordInput
            label="Confirm Password"
            name="confirmPassword"
            value={passwordData.confirmPassword}
            onChange={handlePasswordChange}
            placeholder="Re-type password"
          />

          <Button loading={loading} onClick={handleCreatePassword} fullWidth>
            <span>Save & Set Password</span>
          </Button>
        </div>
      )}
    </div>
  );
};

export default CreatePasswordWizard;