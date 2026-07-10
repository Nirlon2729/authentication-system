import api from "./api";

export const signupRequest = async (userData) => {
  const response = await api.post(
    "/auth/signup/request",
    userData
  );

  return response.data;
};
export const signup = async (userData) => {
  const response = await api.post(
    "/auth/signup",
    userData
  );

  return response.data;
};

export const login = async (credentials) => {
  const response = await api.post(
    "/auth/login",
    credentials
  );

  return response.data;
};

export const googleLogin = async (idToken) => {
  const response = await api.post("/auth/google", {
    idToken,
  });

  return response.data;
};

export const forgotPassword = async (data) => {
  const response = await api.post(
    "/auth/forgot-password",
    data
  );

  return response.data;
};

export const verifyOTP = async (data) => {
  const response = await api.post(
    "/auth/verify-otp",
    data
  );

  return response.data;
};
export const verifySignupOTP = async (data) => {
  const response = await api.post(
    "/auth/signup/verify",
    data
  );

  return response.data;
};

export const resetPassword = async (data) => {
  const response = await api.post(
    "/auth/reset-password",
    data
  );

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
  const response = await api.delete(
    "/profile",
    {
      data: { password },
    }
  );

  return response.data;
};
export const changePassword = async (passwordData) => {
  const response = await api.patch(
    "/profile/change-password",
    passwordData
  );

  return response.data;
};
export const requestCreatePasswordOTP = async () => {
  const response = await api.post(
    "/profile/create-password/request"
  );

  return response.data;
};

export const createPassword = async (data) => {
  const response = await api.patch(
    "/profile/create-password",
    data
  );

  return response.data;
};
export const signupComplete = async (data) => {
  const response = await api.post(
    "/auth/signup/complete",
    data
  );

  return response.data;
};
export const requestEmailChangeOTP = async (
  data
) => {
  const response = await api.post(
    "/profile/change-email/request",
    data
  );

  return response.data;
};
export const verifyEmailChangeOTP = async (
  data
) => {
  const response = await api.patch(
    "/profile/change-email",
    data
  );

  return response.data;
};