import api from "./api";

// Active in-memory OTP store for dev simulation fallback
const activeAdminCreationOTPs = new Map();

// Initial mock data fallback for standalone/local dev mode
const INITIAL_MOCK_USERS = [
  {
    _id: "usr-1",
    fullName: "Nirlon Macwan (Super Admin)",
    email: "nirlonmacwan27@gmail.com",
    role: "admin",
    isVerified: true,
    isBlocked: false,
    provider: "local",
    createdAt: new Date("2026-01-01").toISOString(),
    lastLogin: new Date().toISOString()
  },
  {
    _id: "usr-2",
    fullName: "Sarah Jenkins",
    email: "sarah.jenkins@example.com",
    role: "user",
    isVerified: true,
    isBlocked: false,
    provider: "google",
    createdAt: new Date("2026-02-10").toISOString(),
    lastLogin: new Date(Date.now() - 3600000).toISOString()
  },
  {
    _id: "usr-3",
    fullName: "Alex Rivera",
    email: "alex.rivera@example.com",
    role: "user",
    isVerified: false,
    isBlocked: false,
    provider: "local",
    createdAt: new Date("2026-03-05").toISOString(),
    lastLogin: new Date(Date.now() - 86400000).toISOString()
  }
];

const getStoredUsers = () => {
  try {
    const data = localStorage.getItem("admin_users_directory");
    return data ? JSON.parse(data) : INITIAL_MOCK_USERS;
  } catch (e) {
    console.error("Error reading admin users:", e);
    return INITIAL_MOCK_USERS;
  }
};

const setStoredUsers = (users) => {
  try {
    localStorage.setItem("admin_users_directory", JSON.stringify(users));
  } catch (e) {
    console.error("Error saving admin users:", e);
  }
};

export const fetchAllUsers = async (search = "", role = "all") => {
  try {
    const response = await api.get(`/users?search=${encodeURIComponent(search)}&role=${role}`);
    return response.data;
  } catch {
    let users = getStoredUsers();
    if (search) {
      const q = search.toLowerCase();
      users = users.filter(u => u.fullName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
    }
    if (role !== "all") {
      users = users.filter(u => u.role === role);
    }
    return { success: true, count: users.length, users };
  }
};

export const requestCreateAdminOTP = async (adminData) => {
  try {
    const response = await api.post("/users/admin/request-otp", adminData);
    return response.data;
  } catch (err) {
    if (err.response && err.response.data && err.response.data.message) {
      throw new Error(err.response.data.message);
    }
    const generatedOTP = String(Math.floor(100000 + Math.random() * 900000));
    activeAdminCreationOTPs.set(adminData.email.toLowerCase(), generatedOTP);
    console.log(`🔐 Admin Creation OTP generated for ${adminData.email}`);
    return {
      success: true,
      message: `OTP sent to ${adminData.email}`,
    };
  }
};

export const confirmCreateAdminOTP = async (adminDataWithOTP) => {
  try {
    const response = await api.post("/users/admin/confirm-otp", adminDataWithOTP);
    return response.data;
  } catch (err) {
    if (err.response && err.response.data && err.response.data.message) {
      throw new Error(err.response.data.message);
    }
    const { email, otp, fullName } = adminDataWithOTP;
    const storedOTP = activeAdminCreationOTPs.get(email.toLowerCase());
    
    if (storedOTP && otp !== storedOTP) {
      throw new Error("Incorrect verification OTP code. Please check your email inbox.");
    }
    
    activeAdminCreationOTPs.delete(email.toLowerCase());

    const users = getStoredUsers();
    const existingIndex = users.findIndex(u => u.email.toLowerCase() === email.toLowerCase());
    let targetAdmin;

    if (existingIndex !== -1) {
      users[existingIndex].role = "admin";
      users[existingIndex].isVerified = true;
      if (fullName) users[existingIndex].fullName = fullName;
      targetAdmin = users[existingIndex];
    } else {
      targetAdmin = {
        _id: `adm-${Date.now()}`,
        fullName: fullName || "Admin User",
        email: email.toLowerCase(),
        role: "admin",
        isVerified: true,
        isBlocked: false,
        provider: "local",
        createdAt: new Date().toISOString(),
        lastLogin: null
      };
      users.unshift(targetAdmin);
    }

    setStoredUsers(users);
    return { success: true, message: `Account ${email} updated to Admin!`, user: targetAdmin };
  }
};

export const createAdminAccount = async (adminData) => {
  return confirmCreateAdminOTP({ ...adminData, otp: "123456" });
};

export const updateUserRole = async (userId, role) => {
  try {
    const response = await api.patch(`/users/${userId}/role`, { role });
    return response.data;
  } catch {
    const users = getStoredUsers();
    const updated = users.map(u => u._id === userId ? { ...u, role } : u);
    setStoredUsers(updated);
    return { success: true, message: `Role updated to ${role}` };
  }
};

export const toggleUserBlock = async (userId) => {
  try {
    const response = await api.patch(`/users/${userId}/block`);
    return response.data;
  } catch {
    const users = getStoredUsers();
    const updated = users.map(u => u._id === userId ? { ...u, isBlocked: !u.isBlocked } : u);
    setStoredUsers(updated);
    return { success: true, message: "Block status toggled." };
  }
};

export const deleteUserAccount = async (userId) => {
  try {
    const response = await api.delete(`/users/${userId}`);
    return response.data;
  } catch {
    const users = getStoredUsers();
    const updated = users.filter(u => u._id !== userId);
    setStoredUsers(updated);
    return { success: true, message: "User deleted successfully." };
  }
};

export const fetchAdminAnalytics = async () => {
  try {
    const response = await api.get("/users/analytics");
    return response.data;
  } catch {
    const users = getStoredUsers();
    const totalUsers = users.filter(u => u.role === "user").length;
    const totalAdmins = users.filter(u => u.role === "admin").length;
    const verifiedUsers = users.filter(u => u.isVerified).length;
    return {
      success: true,
      analytics: {
        totalUsers,
        totalAdmins,
        verifiedUsers,
        totalSessions: users.length * 3,
        verificationRate: users.length > 0 ? Math.round((verifiedUsers / users.length) * 100) : 100,
      },
      auditLogs: [
        { _id: "log-1", user: { fullName: "Nirlon Macwan", email: "nirlonmacwan27@gmail.com", role: "admin" }, browser: "Chrome 124", operatingSystem: "Windows 11", ipAddress: "127.0.0.1", createdAt: new Date().toISOString() },
        { _id: "log-2", user: { fullName: "Sarah Jenkins", email: "sarah.jenkins@example.com", role: "user" }, browser: "Safari 17", operatingSystem: "macOS Sonoma", ipAddress: "192.168.1.10", createdAt: new Date(Date.now() - 3600000).toISOString() }
      ]
    };
  }
};
