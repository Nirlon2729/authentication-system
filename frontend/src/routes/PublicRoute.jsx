import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const PublicRoute = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  const allowedRoutes = [
    "/forgot-password",
    "/verify-otp",
    "/reset-password",
  ];

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          fontSize: "22px",
          fontWeight: "600",
        }}
      >
        Loading...
      </div>
    );
  }

  if (user && !allowedRoutes.includes(location.pathname)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

export default PublicRoute;