import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { motion } from "framer-motion";
import AuthLayout from "../../layouts/AuthLayout";
import { Mail, Lock } from "lucide-react";
import Input from "../../components/ui/Input/Input";
import PasswordInput from "../../components/ui/PasswordInput/PasswordInput";
import Checkbox from "../../components/ui/Checkbox/Checkbox";
import GoogleButton from "../../components/ui/GoogleButton/GoogleButton";
import Button from "../../components/ui/Button/Button";
import "../../styles/pages/login.css";
import { googleSignIn } from "../../services/googleAuth";
import {
  googleLogin,
  login,
} from "../../services/authService";
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

      loginUser(
        response.user,
        response.token
      );

      toast.success("Google Login Successful");

      navigate("/dashboard");
    } catch (error) {
      console.error(error);

      toast.error(
        error.response?.data?.message ||
        error.message ||
        "Google Login Failed"
      );
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
      [name]:
        type === "checkbox"
          ? checked
          : value,
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

      loginUser(
        response.user,
        response.token
      );

      toast.success(
        response.message || "Login successful."
      );

      navigate("/dashboard");
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
        "Login failed."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Welcome Back 👋"
      subtitle="Sign in to continue to your account"
    >
      <motion.div
        initial={{
          opacity: 0,
          y: 30,
        }}
        animate={{
          opacity: 1,
          y: 0,
        }}
        transition={{
          duration: .5,
        }}
      >

        ...

      </motion.div>
      <form onSubmit={handleLogin}>
        <Input

          label="Email"
          type="email"
          name="email"
          value={formData.email}
          onChange={handleChange}
          error={errors.email}
          placeholder="Enter your email"
        />

        <PasswordInput
          label="Password"
          name="password"
          value={formData.password}
          onChange={handleChange}
          error={errors.password}
        />

        <div className="login-options">
          <Checkbox
            label="Remember Me"
            name="remember"
            checked={formData.remember}
            onChange={handleChange}
          />

          <Link
            className="forgot-link"
            to="/forgot-password"
          >
            Forgot Password?
          </Link>
        </div>

        <Button
          type="submit"
          loading={loading}
          fullWidth
        >
          Sign In
        </Button>
      </form>

      <div className="divider">
        <span>OR</span>
      </div>

      <GoogleButton
        onClick={handleGoogleLogin}
        loading={loading}
      />

      <div className="auth-footer">
  <p>Don't have an account?</p>

  <Link to="/signup">
    Create Account
  </Link>
</div>
    </AuthLayout>
  );
};

export default Login;