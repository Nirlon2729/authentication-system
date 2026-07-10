import api from "./api";

export const getUserSessions = async () => {
  const response = await api.get(
    "/profile/sessions"
  );

  return response.data;
};
export const logoutSession = async (
  sessionId
) => {
  const response = await api.delete(
    `/profile/sessions/${sessionId}`
  );

  return response.data;
};