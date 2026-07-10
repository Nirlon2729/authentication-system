import { useEffect, useState } from "react";
import { toast } from "react-toastify";

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

      const response =
        await requestCreatePasswordOTP();

      toast.success(response.message);

      setStep(2);

      setSeconds(30);

      setCanResend(false);
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          "Failed to send OTP."
      );
    } finally {
      setLoading(false);
    }
  };
    const handleVerifyOTP = async () => {
    if (otp.length !== 6) {
      toast.error("Please enter a valid OTP.");
      return;
    }

    try {
      setLoading(true);

      const response = await verifyOTP({
        email: user.email,
        otp,
        type: "CREATE_PASSWORD",
      });

      toast.success(response.message);

      setStep(3);
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          "OTP verification failed."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    try {
      setLoading(true);

      const response =
        await requestCreatePasswordOTP();

      toast.success(response.message);

      setSeconds(30);
      setCanResend(false);
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          "Failed to resend OTP."
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
      toast.error(
        "Password must be at least 8 characters."
      );
      return;
    }

    if (
      passwordData.password !==
      passwordData.confirmPassword
    ) {
      toast.error("Passwords do not match.");
      return;
    }

    try {
      setLoading(true);

      const response = await createPassword({
        password: passwordData.password,
      });

      toast.success(response.message);

      await loadUser();
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          "Failed to create password."
      );
    } finally {
      setLoading(false);
    }
  };
    return (
    <div className="create-password-card">
      <div className="wizard-header">
        <div className="wizard-icon">🔐</div>

        <h2>Create Password</h2>

        <p>
          Add a password so you can sign in using both
          Google and your email address.
        </p>
      </div>

      <div className="email-box">
        <span>Email</span>

        <strong>{user.email}</strong>
      </div>

      <div className="step-badge">
        Step {step} of 3
      </div>

      {/* ---------------- STEP 1 ---------------- */}

      {step === 1 && (
        <div className="wizard-section">

          <h3>Verify your email</h3>

          <p>
            We'll send a 6-digit verification code to
            your email address.
          </p>

          <Button
            loading={loading}
            onClick={handleSendOTP}
          >
            Send Verification Code
          </Button>

        </div>
      )}

      {/* ---------------- STEP 2 ---------------- */}

      {step === 2 && (
        <div className="wizard-section">

          <h3>Enter Verification Code</h3>

          <p>
            Check your inbox and enter the code below.
          </p>

          <OTPInput
            value={otp}
            onChange={(e) =>
              setOtp(e.target.value)
            }
          />

          <Button
            loading={loading}
            onClick={handleVerifyOTP}
          >
            Verify OTP
          </Button>

          <div className="resend-container">

            {canResend ? (
              <button
                type="button"
                className="resend-btn"
                onClick={handleResendOTP}
              >
                Resend OTP
              </button>
            ) : (
              <p className="resend-text">
                Resend OTP in {seconds}s
              </p>
            )}

          </div>

        </div>
      )}

      {/* ---------------- STEP 3 ---------------- */}

      {step === 3 && (
        <div className="wizard-section">

          <h3>Create Your Password</h3>

          <PasswordInput
            label="New Password"
            name="password"
            value={passwordData.password}
            onChange={handlePasswordChange}
          />

          <PasswordStrength
            password={passwordData.password}
          />

          <PasswordInput
            label="Confirm Password"
            name="confirmPassword"
            value={passwordData.confirmPassword}
            onChange={handlePasswordChange}
          />

          <Button
            loading={loading}
            onClick={handleCreatePassword}
          >
            Save Password
          </Button>

        </div>
      )}
    </div>
  );
};

export default CreatePasswordWizard;