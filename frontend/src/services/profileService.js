import api from "./api";

export const uploadAvatar = async (file) => {
  const formData = new FormData();

  formData.append("avatar", file);

  const { data } = await api.patch(
    "/profile/avatar",
    formData,
    {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    }
  );

  return data;
};

export const updateProfile = async (body) => {
  const { data } = await api.put(
    "/profile",
    body
  );

  return data;
};