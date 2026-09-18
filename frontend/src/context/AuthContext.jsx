import {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";
import { logout as logoutAPI, getProfile } from "../services/authService";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [restrictedInfo, setRestrictedInfo] = useState(null);

  const isSuperAdmin = user?.role === "super_admin";
  const isAdmin = user?.role === "admin" || isSuperAdmin;

  const login = (userData, token) => {
    if (token) localStorage.setItem("token", token);
    
    if (userData && userData.email) {
      if (userData.isVerified) {
        localStorage.setItem(`verified_email_${userData.email}`, "true");
      }
      const isEmailVerifiedStored = localStorage.getItem(`verified_email_${userData.email}`) === "true";
      userData.isVerified = userData.isVerified || isEmailVerifiedStored;
    }
    setUser({ ...userData });
  };

  const logout = async () => {
    try {
      await logoutAPI();
    } catch (error) {
      console.error(error);
    } finally {
      localStorage.removeItem("token");
      setUser(null);
    }
  };

  const loadUser = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        setLoading(false);
        return;
      }

      const response = await getProfile();
      const loadedUser = response.user;

      if (loadedUser && loadedUser.email) {
        const isEmailVerifiedStored = localStorage.getItem(`verified_email_${loadedUser.email}`) === "true";
        if (isEmailVerifiedStored) loadedUser.isVerified = true;
      }

      setUser(loadedUser);
    } catch (error) {
      console.error("Failed to load user profile:", error.message);
      if (error.response?.status === 401) {
        localStorage.removeItem("token");
        setUser(null);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUser();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAdmin,
        isSuperAdmin,
        restrictedInfo,
        setRestrictedInfo,
        login,
        logout,
        loadUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// oxlint-disable-next-line react/only-export-components
export const useAuth = () => {
  return useContext(AuthContext);
};