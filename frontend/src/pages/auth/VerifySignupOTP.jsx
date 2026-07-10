import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

import AuthLayout from "../../layouts/AuthLayout";
import OTPInput from "../../components/ui/OTPInput/OTPInput";
import Button from "../../components/ui/Button/Button";

import {
    verifyOTP,
    signupComplete,
    signupRequest,
} from "../../services/authService";

import { useAuth } from "../../context/AuthContext";

const VerifySignupOTP = () => {
    const navigate = useNavigate();
    const location = useLocation();

    const { login } = useAuth();

    const formData = location.state?.formData;

    const email = formData?.email || "";
    useEffect(() => {
        if (!formData) {
            toast.error(
                "Signup session expired. Please sign up again."
            );

            navigate("/signup", {
                replace: true,
            });
        }
    }, [formData, navigate]);

    const [otp, setOtp] = useState("");
    const [loading, setLoading] = useState(false);

    const [seconds, setSeconds] = useState(30);
    const [canResend, setCanResend] = useState(false);

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

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (loading) return;
        if (otp.length !== 6) {
            toast.error("Please enter a valid OTP.");
            return;
        }

        try {
            setLoading(true);

            // Step 1: Verify OTP
            await verifyOTP({
                email,
                otp,
                type: "SIGNUP",
            });

            // Step 2: Create account
            const response = await signupComplete({
                email,
            });

            // Step 3: Login user
            login(
                response.user,
                response.token
            );

            toast.success(
                "Account created successfully!"
            );

            navigate("/dashboard");
        } catch (error) {
            toast.error(
                error.response?.data?.message ||
                "Signup failed."
            );
        } finally {
            setLoading(false);
        }
    };
    const handleResendOTP = async () => {
        if (loading) return;
        try {
            setLoading(true);

            const response =
                await signupRequest(formData);

            toast.success(
                response.message ||
                "OTP sent successfully."
            );

            setOtp("");

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
    return (
        <AuthLayout
            title="Verify Email"
            subtitle={`Enter the OTP sent to ${email}`}
        >
            <form onSubmit={handleSubmit}>
                <OTPInput
                    value={otp}
                    onChange={(e) =>
                        setOtp(e.target.value)
                    }
                />

                <Button
                    type="submit"
                    loading={loading}
                >
                    Verify & Create Account
                </Button>

                <div
                    style={{
                        marginTop: "20px",
                        textAlign: "center",
                    }}
                >
                    {canResend ? (
                        <button
                            type="button"
                            onClick={handleResendOTP}
                            disabled={loading}
                            style={{
                                border: "none",
                                background: "none",
                                color: loading ? "#9ca3af" : "#2563eb",
                                cursor: loading ? "not-allowed" : "pointer",
                            }}
                        >
                            Resend OTP
                        </button>
                    ) : (
                        <p>
                            Resend OTP in {seconds}s
                        </p>
                    )}
                </div>
            </form>

            <div className="auth-footer">
                <Link to="/signup">
                    Back
                </Link>
            </div>
        </AuthLayout>
    );
};

export default VerifySignupOTP;