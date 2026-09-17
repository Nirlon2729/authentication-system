import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Loader from "../components/ui/Loader/Loader";
import { toast } from "react-toastify";

const AdminRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <Loader fullScreen />;
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  if (user.role !== "admin") {
    toast.error("Access Denied: Admin privileges required.");
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

export default AdminRoute;
