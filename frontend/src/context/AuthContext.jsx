import {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";
import { logout as logoutAPI } from "../services/authService";
import { getProfile } from "../services/authService";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);

  const [loading, setLoading] = useState(true);

  const login = (userData, token) => {
    localStorage.setItem("token", token);

    setUser(userData);
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

      setUser(response.user);
    } catch (error) {
      console.error(error);

      localStorage.removeItem("token");

      setUser(null);
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
        login,
        logout,
        loadUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  return useContext(AuthContext);
};