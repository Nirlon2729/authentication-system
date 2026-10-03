import api from "./api";

export const signupRequest = async (userData) => {
  const response = await api.post("/auth/signup/request", userData);
  return response.data;
};

export const signup = async (userData) => {
  const response = await api.post("/auth/signup", userData);
  return response.data;
};

export const login = async (credentials) => {
  const response = await api.post("/auth/login", credentials);
  return response.data;
};

export const googleLogin = async (idToken, remember = false) => {
  const response = await api.post("/auth/google", {
    idToken,
    remember,
  });
  return response.data;
};

export const forgotPassword = async (data) => {
  const payload = typeof data === "string" ? { email: data } : data;
  const response = await api.post("/auth/forgot-password", payload);
  return response.data;
};

export const verifyOTP = async (data) => {
  const response = await api.post("/auth/verify-otp", data);
  return response.data;
};

export const verifyOTPController = verifyOTP;

export const resendOTP = async (email, type = "PASSWORD_RESET") => {
  const response = await api.post("/auth/forgot-password", { email, type });
  return response.data;
};

export const verifySignupOTP = async (data) => {
  const response = await api.post("/auth/verify-otp", {
    ...data,
    type: "SIGNUP",
  });
  return response.data;
};

export const resetPassword = async (data) => {
  const response = await api.post("/auth/reset-password", data);
  return response.data;
};

export const logout = async () => {
  const response = await api.post("/auth/logout");
  return response.data;
};

export const getProfile = async () => {
  const response = await api.get("/profile");
  return response.data;
};

export const deleteAccount = async (password = "") => {
  const response = await api.delete("/profile", {
    data: { password },
  });
  return response.data;
};

export const changePassword = async (passwordData) => {
  const response = await api.patch(
    "/profile/change-password",
    passwordData
  );
  return response.data;
};

export const requestChangePasswordOTP = async () => {
  const response = await api.post("/profile/change-password/request");
  return response.data;
};

export const verifyChangePasswordOTP = async (data) => {
  const response = await api.post("/profile/change-password/verify-otp", data);
  return response.data;
};

export const requestCreatePasswordOTP = async () => {
  const response = await api.post("/profile/create-password/request");
  return response.data;
};

export const createPassword = async (data) => {
  const response = await api.patch("/profile/create-password", data);
  return response.data;
};

export const signupComplete = async (data) => {
  const payload = typeof data === "string" ? { email: data } : data;
  const response = await api.post("/auth/signup/complete", payload);
  return response.data;
};

export const requestEmailChangeOTP = async (data) => {
  const response = await api.post("/profile/change-email/request", data);
  return response.data;
};

export const verifyEmailChangeOTP = async (data) => {
  const response = await api.patch("/profile/change-email", data);
  return response.data;
};

export const getLoginHistory = async (params = {}) => {
  const response = await api.get("/profile/login-history", { params });
  return response.data;
};

export const getRecognizedDevices = async () => {
  const response = await api.get("/profile/recognized-devices");
  return response.data;
};

export const revokeRecognizedDevice = async (deviceId) => {
  const response = await api.delete(`/profile/recognized-devices/${deviceId}`);
  return response.data;
};

export const secureAccount = async () => {
  const response = await api.post("/profile/secure-account");
  return response.data;
};

export const reviewLoginEvent = async (eventId, status) => {
  const response = await api.post(`/profile/review-login/${eventId}`, { status });
  return response.data;
};

export const getAdminLoginIncidents = async (params = {}) => {
  const response = await api.get("/security/admin/login-incidents", { params });
  return response.data;
};

export const updateAdminIncidentStatus = async (id, data) => {
  const response = await api.patch(`/security/admin/login-incidents/${id}/status`, data);
  return response.data;
};