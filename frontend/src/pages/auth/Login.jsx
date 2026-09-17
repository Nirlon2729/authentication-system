import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { ArrowRight } from "lucide-react";
import AuthLayout from "../../layouts/AuthLayout";
import Input from "../../components/ui/Input/Input";
import Checkbox from "../../components/ui/Checkbox/Checkbox";
import GoogleButton from "../../components/ui/GoogleButton/GoogleButton";
import MicrosoftButton from "../../components/ui/MicrosoftButton/MicrosoftButton";
import Button from "../../components/ui/Button/Button";
import "../../styles/pages/login.css";
import { googleSignIn } from "../../services/googleAuth";
import { googleLogin, login } from "../../services/authService";
import { useAuth } from "../../context/AuthContext";

const Login = () => {
  const navigate = useNavigate();
  const { login: loginUser } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      const idToken = await googleSignIn();
      const response = await googleLogin(idToken);
      loginUser(response.user, response.token);
      toast.success("Google Login Successful 🎉");

      if (response.user?.role === "admin") {
        navigate("/admin");
      } else {
        navigate("/dashboard");
      }
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.message || error.message || "Google Login Failed");
    } finally {
      setLoading(false);
    }
  };

  const handleMicrosoftLogin = () => {
    toast.info("Microsoft authentication initiated...");
    handleGoogleLogin();
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

      if (response.user?.role === "admin") {
        navigate("/admin");
      } else {
        navigate("/dashboard");
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Login failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Welcome Back!"
      subtitle="Login to continue to your account"
    >
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