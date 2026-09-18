import axios from "axios";

const getBaseURL = () => {
  const envUrl = import.meta.env.VITE_API_URL;
  if (!envUrl) return "http://localhost:8000/api";

  let url = envUrl.trim();
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    url = `https://${url}`;
  }
  if (!url.endsWith("/api")) {
    url = `${url.replace(/\/+$/, "")}/api`;
  }
  return url;
};

const api = axios.create({
  baseURL: getBaseURL(),
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true,
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    // If 401 Unauthorized received on a protected endpoint
    if (error.response && error.response.status === 401) {
      const isAuthRoute =
        error.config?.url?.includes("/auth/login") ||
        error.config?.url?.includes("/auth/signup") ||
        error.config?.url?.includes("/auth/verify-otp") ||
        error.config?.url?.includes("/auth/forgot-password");

      const isSecurityTestRoute =
        error.config?.url?.includes("/security/test-traffic") ||
        error.config?.url?.includes("/security/admin/test");

      if (!isAuthRoute && !isSecurityTestRoute && localStorage.getItem("token")) {
        localStorage.removeItem("token");
      }
    }
    return Promise.reject(error);
  }
);

export default api;