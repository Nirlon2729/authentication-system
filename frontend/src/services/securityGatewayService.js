import api from "./api";

/**
 * 1. Fetch SOC Dashboard Live Stats with optional trafficType filter
 * trafficType: 'ALL' | 'REAL' | 'SIMULATION'
 */
export const fetchSecurityStats = async (trafficType = "ALL") => {
  const response = await api.get("/security/admin/stats", {
    params: { trafficType },
  });
  return response.data;
};

/**
 * 2. Fetch Paginated & Filtered Security Events
 */
export const fetchSecurityEvents = async (params = {}) => {
  const response = await api.get("/security/admin/events", { params });
  return response.data;
};

/**
 * 3. Fetch Real-time Live Security Stream (In-Memory Buffer)
 */
export const fetchLiveSecurityFeed = async (trafficType = "ALL") => {
  const response = await api.get("/security/admin/feed", {
    params: { trafficType },
  });
  return response.data;
};

/**
 * 4. Fetch Traffic Timeline Chart Data
 */
export const fetchTrafficTimeline = async (range = "15m", trafficType = "ALL") => {
  const response = await api.get("/security/admin/traffic", {
    params: { range, trafficType },
  });
  return response.data;
};

/**
 * 5. Fetch Threat & Risk Score Analytics
 */
export const fetchThreatAnalytics = async (trafficType = "ALL") => {
  const response = await api.get("/security/admin/threats", {
    params: { trafficType },
  });
  return response.data;
};

/**
 * 6. Fetch Active Blocked Clients
 */
export const fetchBlockedClients = async (trafficType = "ALL") => {
  const response = await api.get("/security/admin/blocked", {
    params: { trafficType },
  });
  return response.data;
};

/**
 * 7. Manually Unblock Client
 */
export const unblockSecurityClient = async (clientId) => {
  const response = await api.post(`/security/admin/unblock/${encodeURIComponent(clientId)}`);
  return response.data;
};

/**
 * 8. Export Security Events to CSV
 */
export const exportSecurityCSV = async (params = {}) => {
  const response = await api.get("/security/admin/export", {
    params,
    responseType: "blob",
  });
  return response.data;
};

/**
 * 9. Start Controlled Security Simulation
 * Requests a secure server-generated simulation context with cryptographic authorization
 */
export const startSecuritySimulation = async ({
  testType = "NORMAL_TRAFFIC",
  requestCount = 25,
  intervalMs = 250,
}) => {
  const response = await api.post("/security/admin/test/start", {
    testType,
    requestCount,
    intervalMs,
  });
  return response.data;
};

/**
 * 10. Send Controlled Test Request (Security Test Lab)
 * Sends individual synthetic requests using verified simulation headers
 */
export const sendSecurityTestTraffic = async (testPayload = {}, simulationHeaders = {}) => {
  const headers = {};
  if (simulationHeaders.simulationId) {
    headers["X-Simulation-Id"] = simulationHeaders.simulationId;
  }
  if (simulationHeaders.simulationToken) {
    headers["X-Simulation-Token"] = simulationHeaders.simulationToken;
  }

  const response = await api.post("/security/test-traffic", testPayload, { headers });
  return response.data;
};

/**
 * 11. Stop Active Simulation
 */
export const stopSecuritySimulation = async (simulationId = "") => {
  const response = await api.post("/security/admin/test/stop", { simulationId });
  return response.data;
};

/**
 * 12. Fetch Website Lockdown Status (Super Admin)
 */
export const fetchWebsiteLockdownStatus = async () => {
  const response = await api.get("/security/super-admin/website-status");
  return response.data;
};

/**
 * 13. Enable Global Website Lockdown (Super Admin)
 */
export const enableWebsiteLockdown = async ({ reason = "", expiresAt = null } = {}) => {
  const response = await api.post("/security/super-admin/website/lockdown", {
    reason,
    expiresAt,
  });
  return response.data;
};

/**
 * 14. Restore Website to Online (Super Admin)
 */
export const restoreWebsite = async () => {
  const response = await api.post("/security/super-admin/website/restore");
  return response.data;
};

/**
 * 15. Fetch Active Blocked Users List (Admin & Super Admin)
 */
export const fetchBlockedUsers = async () => {
  const response = await api.get("/security/admin/blocked-users");
  return response.data;
};

/**
 * 16. Manually Unblock a User Account (Admin & Super Admin)
 */
export const unblockUserAccount = async (userId) => {
  const response = await api.post(`/security/admin/unblock-user/${userId}`);
  return response.data;
};

/**
 * 17. Manually Block a User Account (Admin & Super Admin)
 */
export const blockUserAccount = async (userId, { reason = "", durationMinutes = 15 } = {}) => {
  const response = await api.post(`/security/admin/block-user/${userId}`, {
    reason,
    durationMinutes,
  });
  return response.data;
};

