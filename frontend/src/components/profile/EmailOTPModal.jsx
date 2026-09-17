import { useState, useEffect } from "react";
import { X, Mail, ShieldCheck, RefreshCw } from "lucide-react";
import Button from "../ui/Button/Button";
import OTPInput from "../ui/OTPInput/OTPInput";
import { toast } from "react-toastify";
import { requestEmailVerifyOTP, verifyEmailOTP } from "../../services/profileService";

const EmailOTPModal = ({
  email,
  title = "Verify Email Address",
  subtitle = "",
  onResend,
  onVerify,
  onClose,
  onSuccess,
}) => {
  const [otp, setOtp] = useState("");
  const [timer, setTimer] = useState(60);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    let interval = null;
    if (timer > 0) {
      interval = setInterval(() => setTimer((t) => t - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [timer]);

  const handleResend = async () => {
    setResending(true);
    try {
      if (onResend) {
        await onResend();
      } else {
        await requestEmailVerifyOTP(email);
      }
      setTimer(60);
      toast.info(`New verification code sent to ${email}`);
    } catch (err) {
      toast.error(err.message || "Failed to resend OTP");
    } finally {
      setResending(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (otp.length < 6) {
      toast.error("Please enter the complete 6-digit OTP.");
      return;
    }

    setLoading(true);
    try {
      if (onVerify) {
        await onVerify(otp);
      } else {
        await verifyEmailOTP(email, otp);
        toast.success("Email address verified successfully! 🎉");
      }
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Invalid OTP code. Check your email.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="otp-modal-card">
        <div className="modal-header">
          <div className="modal-title-group">
            <div className="title-icon-badge email-badge">
              <Mail size={22} />
            </div>
            <div>
              <h2>{title}</h2>
              <p>{subtitle || `Verification OTP code sent to ${email}`}</p>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body">
          <div className="otp-input-section">
            <label className="section-label">Enter 6-Digit Email Verification Code</label>
            <OTPInput value={otp} onChange={setOtp} numInputs={6} />
          </div>

          <div className="otp-resend-row">
            {timer > 0 ? (
              <span className="timer-text">Resend code in {timer}s</span>
            ) : (
              <button
                type="button"
                className="resend-btn"
                onClick={handleResend}
                disabled={resending}
              >
                <RefreshCw size={14} className={resending ? "spin-icon" : ""} />
                <span>Resend Email OTP</span>
              </button>
            )}
          </div>

          <div className="modal-footer">
            <Button variant="secondary" type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={loading || otp.length < 6}>
              <ShieldCheck size={16} />
              <span>{loading ? "Verifying..." : "Verify & Confirm"}</span>
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EmailOTPModal;
