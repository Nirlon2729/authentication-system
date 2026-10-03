import api from "./api";

export const uploadAvatar = async (file) => {
  const formData = new FormData();
  formData.append("avatar", file);

  const { data } = await api.patch("/profile/avatar", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });

  return data;
};

export const updateProfile = async (body) => {
  const { data } = await api.put("/profile", body);
  return data;
};

export const requestEmailVerifyOTP = async (email) => {
  const { data } = await api.post("/profile/verify-email/request", { email });
  return data;
};

export const verifyEmailOTP = async (email, otp) => {
  const { data } = await api.post("/profile/verify-email/confirm", { email, otp });
  return data;
};