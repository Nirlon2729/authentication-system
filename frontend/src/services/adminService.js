import api from "./api";

export const fetchAllUsers = async (search = "", role = "all") => {
  const response = await api.get(`/users?search=${encodeURIComponent(search)}&role=${role}`);
  return response.data;
};

export const requestCreateAdminOTP = async (adminData) => {
  try {
    const response = await api.post("/users/admin/request-otp", adminData);
    return response.data;
  } catch (err) {
    if (err.response?.data?.message) {
      throw new Error(err.response.data.message);
    }
    throw err;
  }
};

export const confirmCreateAdminOTP = async (adminDataWithOTP) => {
  try {
    const response = await api.post("/users/admin/confirm-otp", adminDataWithOTP);
    return response.data;
  } catch (err) {
    if (err.response?.data?.message) {
      throw new Error(err.response.data.message);
    }
    throw err;
  }
};

export const updateUserRole = async (userId, role) => {
  try {
    const response = await api.patch(`/users/${userId}/role`, { role });
    return response.data;
  } catch (err) {
    if (err.response?.data?.message) {
      throw new Error(err.response.data.message);
    }
    throw err;
  }
};

export const toggleUserBlock = async (userId) => {
  try {
    const response = await api.patch(`/users/${userId}/block`);
    return response.data;
  } catch (err) {
    if (err.response?.data?.message) {
      throw new Error(err.response.data.message);
    }
    throw err;
  }
};

export const deleteUserAccount = async (userId) => {
  try {
    const response = await api.delete(`/users/${userId}`);
    return response.data;
  } catch (err) {
    if (err.response?.data?.message) {
      throw new Error(err.response.data.message);
    }
    throw err;
  }
};

export const fetchAdminAnalytics = async () => {
  try {
    const response = await api.get("/users/analytics");
    return response.data;
  } catch (err) {
    if (err.response?.data?.message) {
      throw new Error(err.response.data.message);
    }
    throw err;
  }
};
