import { useState } from "react";
import { toast } from "react-toastify";
import { CheckCircle2, ArrowRight } from "lucide-react";

import Input from "../ui/Input/Input";
import Button from "../ui/Button/Button";
import OTPInput from "../ui/OTPInput/OTPInput";

import {
  requestEmailChangeOTP,
  verifyEmailChangeOTP,
} from "../../services/authService";

import { useAuth } from "../../context/AuthContext";

const ChangeEmailForm = () => {
  const { user, login } = useAuth();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    password: "",
    newEmail: "",
    otp: "",
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleRequestOTP = async (e) => {
    if (e) e.preventDefault();
    if (!formData.password) {
      toast.error("Please enter your current password.");
      return;
    }
    if (!formData.newEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.newEmail)) {
      toast.error("Please enter a valid new email address.");
      return;
    }

    try {
      setLoading(true);
      const response = await requestEmailChangeOTP({
        password: formData.password,
        newEmail: formData.newEmail,
      });

      toast.success(response.message || "OTP sent to your new email address.");
      setStep(2);
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Failed to send verification OTP."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e) => {
    if (e) e.preventDefault();
    if (!formData.otp || formData.otp.length !== 6) {
      toast.error("Please enter the 6-digit OTP sent to your new email.");
      return;
    }

    try {
      setLoading(true);
      const response = await verifyEmailChangeOTP({
        newEmail: formData.newEmail,
        otp: formData.otp,
      });

      login(response.user, response.token);
      toast.success(response.message || "Email address updated successfully 🎉");
      setStep(1);
      setFormData({
        password: "",
        newEmail: "",
        otp: "",
      });
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Failed to change email address."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: "560px", margin: "0 auto" }}>
      <div style={{ marginBottom: "1.75rem", textAlign: "center" }}>
        <h2
          style={{
            fontSize: "1.45rem",
            fontWeight: "800",
            color: "var(--text-primary)",
            margin: "0 0 0.35rem 0",
          }}
        >
          Change Primary Email
        </h2>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.88rem", margin: "0 0 1.25rem 0" }}>
          Current Email: <strong>{user?.email}</strong>
        </p>

        {/* 2 Steps Indicator */}
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "0.6rem" }}>
          {[1, 2].map((s) => (
            <div key={s} style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
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
              {s < 2 && (
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

      {step === 1 ? (
        <form onSubmit={handleRequestOTP} style={{ display: "flex", flexDirection: "column", gap: "1.1rem" }}>
          <Input
            label="Current Password"
            type="password"
            name="password"
            placeholder="Enter your current password"
            value={formData.password}
            onChange={handleChange}
            required
          />

          <Input
            label="New Email Address"
            type="email"
            name="newEmail"
            placeholder="Enter your new email address"
            value={formData.newEmail}
            onChange={handleChange}
            required
          />

          <Button type="submit" loading={loading} fullWidth>
            <span>Send Verification OTP</span>
            <ArrowRight size={16} />
          </Button>
        </form>
      ) : (
        <form onSubmit={handleVerify} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          <p style={{ fontSize: "0.88rem", color: "var(--text-secondary)", textAlign: "center", margin: 0 }}>
            Enter the 6-digit verification code sent to <strong>{formData.newEmail}</strong>.
          </p>

          <OTPInput
            value={formData.otp}
            onChange={(val) => setFormData((prev) => ({ ...prev, otp: typeof val === "string" ? val : val.target.value }))}
          />

          <Button type="submit" loading={loading} fullWidth>
            <span>Verify & Update Email</span>
          </Button>

          <div style={{ textAlign: "center" }}>
            <button
              type="button"
              onClick={() => setStep(1)}
              style={{
                border: "none",
                background: "none",
                color: "var(--primary-600)",
                cursor: "pointer",
                fontWeight: "700",
                fontSize: "0.85rem",
              }}
            >
              Change new email address
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default ChangeEmailForm;