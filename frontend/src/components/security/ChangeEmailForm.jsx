import { useState } from "react";
import { toast } from "react-toastify";

import Input from "../ui/Input/Input";
import Button from "../ui/Button/Button";

import {
  requestEmailChangeOTP,
  verifyEmailChangeOTP,
} from "../../services/authService";

import { useAuth } from "../../context/AuthContext";

const ChangeEmailForm = () => {
  const { login } = useAuth();

  const [step, setStep] = useState(1);

  const [loading, setLoading] =
    useState(false);

  const [formData, setFormData] =
    useState({
      password: "",
      newEmail: "",
      otp: "",
    });

  const handleChange = (e) => {
    const { name, value } =
      e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleRequestOTP =
    async () => {
      try {
        setLoading(true);

        const response =
          await requestEmailChangeOTP({
            password:
              formData.password,
            newEmail:
              formData.newEmail,
          });

        toast.success(
          response.message
        );

        setStep(2);
      } catch (error) {
        toast.error(
          error.response?.data
            ?.message ||
            "Failed to send OTP."
        );
      } finally {
        setLoading(false);
      }
    };

  const handleVerify =
    async () => {
      try {
        setLoading(true);

        const response =
          await verifyEmailChangeOTP({
            newEmail:
              formData.newEmail,
            otp: formData.otp,
          });

        login(
          response.user,
          response.token
        );

        toast.success(
          response.message
        );

        setStep(1);

        setFormData({
          password: "",
          newEmail: "",
          otp: "",
        });
      } catch (error) {
        toast.error(
          error.response?.data
            ?.message ||
            "Failed to change email."
        );
      } finally {
        setLoading(false);
      }
    };

  return (
    <div
      style={{
        marginTop: "40px",
      }}
    >
      <h2>Change Email</h2>

      {step === 1 ? (
        <>
          <Input
            label="Current Password"
            type="password"
            name="password"
            placeholder={"Enter your logged in password"}
            value={
              formData.password
            }
            onChange={
              handleChange
            }
          />

          <Input
            label="New Email"
            type="email"
            name="newEmail"
             placeholder={"Enter your new email "}
            value={
              formData.newEmail
            }
            onChange={
              handleChange
            }
          />

          <Button
            loading={loading}
            onClick={
              handleRequestOTP
            }
          >
            Send OTP
          </Button>
        </>
      ) : (
        <>
          <Input
            label="OTP"
            name="otp"
            value={formData.otp}
            onChange={
              handleChange
            }
          />

          <Button
            loading={loading}
            onClick={
              handleVerify
            }
          >
            Verify & Change Email
          </Button>
        </>
      )}
    </div>
  );
};

export default ChangeEmailForm;