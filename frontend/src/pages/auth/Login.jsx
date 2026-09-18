import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { ArrowRight, AlertTriangle } from "lucide-react";
import AuthLayout from "../../layouts/AuthLayout";
import Input from "../../components/ui/Input/Input";
import Checkbox from "../../components/ui/Checkbox/Checkbox";
import GoogleButton from "../../components/ui/GoogleButton/GoogleButton";
import Button from "../../components/ui/Button/Button";
import AccountRestrictedModal from "../../components/security/AccountRestrictedModal";
import "../../styles/pages/login.css";
import { googleSignIn } from "../../services/googleAuth";
import { googleLogin, login } from "../../services/authService";
import { useAuth } from "../../context/AuthContext";

const Login = () => {
  const navigate = useNavigate();
  const { login: loginUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [lockdownNotice, setLockdownNotice] = useState("");
  const [showRestrictedModal, setShowRestrictedModal] = useState(false);
  const [restrictedAccountData, setRestrictedAccountData] = useState({
    blockedUntil: null,
    remainingSeconds: 900,
    reason: "",
  });

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      setLockdownNotice("");
      const idToken = await googleSignIn();
      const response = await googleLogin(idToken);
      loginUser(response.user, response.token);
      toast.success("Google Login Successful 🎉");

      if (response.user?.role === "admin" || response.user?.role === "super_admin") {
        navigate("/admin");
      } else {
        navigate("/dashboard");
      }
    } catch (error) {
      console.error(error);
      const errData = error.response?.data;
      if (error.response?.status === 503 || errData?.code === "SERVICE_UNAVAILABLE") {
        setLockdownNotice(errData?.message || "Website is temporarily unavailable for security maintenance. Please try again later.");
      } else if (error.response?.status === 403 && errData?.code === "USER_TEMPORARILY_BLOCKED") {
        setRestrictedAccountData({
          blockedUntil: errData.blockedUntil,
          remainingSeconds: errData.remainingSeconds || 900,
          reason: errData.message || "Your account has been temporarily restricted due to suspicious activity.",
        });
        setShowRestrictedModal(true);
      } else {
        toast.error(errData?.message || error.message || "Google Login Failed");
      }
    } finally {
      setLoading(false);
    }
  };

  const [formData, setFormData] = useState({
    email: "",
    password: "",
    remember: false,
  });

  const [errors, setErrors] = useState({});

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.email.trim()) {
      newErrors.email = "Email is required.";
    }
    if (!formData.password) {
      newErrors.password = "Password is required.";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      toast.error("Please fix the errors.");
      return;
    }

    try {
      setLoading(true);

      const response = await login({
        email: formData.email,
        password: formData.password,
        remember: formData.remember,
      });

      loginUser(response.user, response.token);
      toast.success(response.message || "Login successful.");

      if (response.user?.role === "admin" || response.user?.role === "super_admin") {
        navigate("/admin");
      } else {
        navigate("/dashboard");
      }
    } catch (error) {
      const errData = error.response?.data;
      if (error.response?.status === 503 || errData?.code === "SERVICE_UNAVAILABLE") {
        setLockdownNotice(
          errData?.message ||
            "Website is temporarily unavailable for security maintenance. Please try again later."
        );
      } else if (
        error.response?.status === 403 &&
        errData?.code === "USER_TEMPORARILY_BLOCKED"
      ) {
        setRestrictedAccountData({
          blockedUntil: errData.blockedUntil,
          remainingSeconds: errData.remainingSeconds || 900,
          reason:
            errData.message ||
            "Your account has been temporarily restricted due to suspicious activity.",
        });
        setShowRestrictedModal(true);
      } else {
        toast.error(errData?.message || "Login failed.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Welcome Back!"
      subtitle="Login to continue to your account"
    >
      {lockdownNotice && (
        <div
          style={{
            background: "rgba(127, 29, 29, 0.4)",
            border: "1px solid rgba(239, 68, 68, 0.6)",
            borderRadius: "0.75rem",
            padding: "0.85rem 1rem",
            marginBottom: "1.25rem",
            display: "flex",
            alignItems: "flex-start",
            gap: "0.75rem",
            color: "#fecaca",
            fontSize: "0.82rem",
            lineHeight: "1.4",
          }}
        >
          <AlertTriangle
            size={18}
            color="#f87171"
            style={{ flexShrink: 0, marginTop: "2px" }}
          />
          <div>
            <strong style={{ display: "block", color: "#ffffff", fontWeight: 700, marginBottom: "2px" }}>
              Website Temporarily Unavailable
            </strong>
            <span>{lockdownNotice}</span>
          </div>
        </div>
      )}

      <AccountRestrictedModal
        isOpen={showRestrictedModal}
        onClose={() => setShowRestrictedModal(false)}
        {...restrictedAccountData}
      />

      <form onSubmit={handleLogin}>
        <Input
          label="Email Address"
          type="email"
          name="email"
          value={formData.email}
          onChange={handleChange}
          error={errors.email}
          placeholder="Enter your email"
        />

        <Input
          label="Password"
          type="password"
          name="password"
          value={formData.password}
          onChange={handleChange}
          error={errors.password}
          placeholder="Enter your password"
        />

        <div className="login-options">
          <Checkbox
            label="Remember me"
            name="remember"
            checked={formData.remember}
            onChange={handleChange}
          />

          <Link className="forgot-link" to="/forgot-password">
            Forgot password?
          </Link>
        </div>

        <Button type="submit" loading={loading} fullWidth>
          <span>Login</span>
          <ArrowRight size={18} />
        </Button>
      </form>

      <div className="divider">
        <span>or continue with</span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        <GoogleButton onClick={handleGoogleLogin} loading={loading} />
        {/* <MicrosoftButton onClick={handleMicrosoftLogin} loading={loading} /> */}
      </div>

      <div className="auth-footer">
        <p>Don't have an account?</p>
        <Link to="/signup">Sign up</Link>
      </div>
    </AuthLayout>
  );
};

export default Login;