import axios from "axios";

const getBaseURL = () => {
  const envUrl = import.meta.env.VITE_API_URL;
  if (!envUrl) return "http://localhost:8000/api";

  let url = envUrl.trim().replace(/\/+$/, "");

  // Extract protocol if present
  const hasHttp = url.startsWith("http://");
  const hasHttps = url.startsWith("https://");
  let protocol = hasHttp ? "http://" : hasHttps ? "https://" : "";
  let withoutProtocol = protocol ? url.slice(protocol.length) : url;

  // Split host and path
  const slashIndex = withoutProtocol.indexOf("/");
  let host = slashIndex !== -1 ? withoutProtocol.slice(0, slashIndex) : withoutProtocol;
  let path = slashIndex !== -1 ? withoutProtocol.slice(slashIndex) : "";

  // Check if host is a local address or a bare Render internal slug (no dots)
  const isLocal = /^localhost(:\d+)?$/i.test(host) || /^127\.0\.0\.1(:\d+)?$/.test(host);
  if (!isLocal && !host.includes(".")) {
    // Render fromService host returns a private slug like 'auth-security-backend-xszl'
    // The public FQDN must be suffixed with .onrender.com
    host = `${host}.onrender.com`;
  }

  // Ensure default protocol
  if (!protocol) {
    protocol = isLocal ? "http://" : "https://";
  }

  let full = `${protocol}${host}${path}`;
  const cleanFull = full.replace(/\/+$/, "");
  if (!cleanFull.endsWith("/api")) {
    return `${cleanFull}/api`;
  }
  return cleanFull;
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