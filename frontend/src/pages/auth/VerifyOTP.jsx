import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import "../../styles/pages/verifyotp.css";
import AuthLayout from "../../layouts/AuthLayout";
import OTPInput from "../../components/ui/OTPInput/OTPInput";
import Button from "../../components/ui/Button/Button";

import {
  verifyOTP,
  forgotPassword,
} from "../../services/authService";

const VerifyOTP = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const email = location.state?.email || "";

  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [seconds, setSeconds] = useState(30);
  const [canResend, setCanResend] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!otp.trim()) {
      toast.error("Please enter the OTP.");
      return;
    }

    try {
      setLoading(true);

      const response = await verifyOTP({
        email,
        otp,
      });

      toast.success(
        response.message || "OTP verified successfully."
      );

      navigate("/reset-password", {
        state: {
          email,
          otp,
        },
      });
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

      const response = await forgotPassword({
        email,
      });

      toast.success(
        response.message || "OTP sent successfully."
      );

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
  return (
    <AuthLayout
     title="Verify Your Email"
      subtitle={`We've sent a 6-digit verification code to ${email}`}
    >
      <form onSubmit={handleSubmit}>
        <OTPInput
          value={otp}
          onChange={(e) => setOtp(e.target.value)}
        />

        <Button
          type="submit"
          loading={loading}
          fullWidth
        >
          Verify OTP
        </Button>
        <div className="otp-footer">
  {canResend ? (
    <button
      type="button"
      onClick={handleResendOTP}
      className="resend-btn"
    >
      Resend OTP
    </button>
  ) : (
    <p className="otp-timer">
      Resend OTP in <strong>{seconds}s</strong>
    </p>
  )}
</div>
      </form>

      <div className="auth-footer">
        <Link to="/forgot-password">
          Back
        </Link>
      </div>
    </AuthLayout>
  );
};

export default VerifyOTP;