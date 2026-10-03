const crypto = require("crypto");
const RecognizedDevice = require("../models/RecognizedDevice");
const Session = require("../models/Session");

/**
 * Normalizes device properties into a consistent fingerprint hash.
 */
function computeDeviceFingerprint(browser = "", operatingSystem = "", device = "") {
  const normBrowser = String(browser || "").split(" ")[0].toLowerCase().trim();
  const normOS = String(operatingSystem || "").split(" ")[0].toLowerCase().trim();
  const normDevice = String(device || "").toLowerCase().trim();
  const raw = `${normBrowser}|${normOS}|${normDevice}`;
  return crypto.createHash("sha256").update(raw).digest("hex").slice(0, 16);
}

/**
 * Resolves or generates the secure pseudonymous device ID.
 * Sets the long-lived HTTP-only cookie if new.
 */
function resolveDeviceId(req, res = null) {
  let deviceId =
    req.cookies?._device_id ||
    req.headers["x-device-id"] ||
    req.headers["device-id"] ||
    null;

  if (typeof deviceId === "string") {
    deviceId = deviceId.trim();
  }

  const isValidUuid = deviceId && /^[a-zA-Z0-9_-]{16,64}$/.test(deviceId);

  if (!isValidUuid) {
    deviceId = crypto.randomUUID();
    if (res && typeof res.cookie === "function") {
      const isProduction =
        process.env.NODE_ENV === "production" &&
        !process.env.CLIENT_URL?.includes("localhost") &&
        !process.env.FRONTEND_URL?.includes("localhost");

      res.cookie("_device_id", deviceId, {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? "none" : "lax",
        maxAge: 365 * 24 * 60 * 60 * 1000, // 1 year
        path: "/",
      });
    }
  }

  return deviceId;
}

/**
 * Checks whether the incoming device is recognized for the specified user.
 */
async function checkDeviceRecognition(userId, deviceId, { browser = "", operatingSystem = "", device = "" } = {}) {
  if (!userId) {
    return { isRecognized: false, isNewDevice: true, isNewBrowserOrOS: true, deviceRecord: null };
  }

  const fingerprint = computeDeviceFingerprint(browser, operatingSystem, device);

  // 1. Direct device ID lookup
  if (deviceId) {
    const matchedDevice = await RecognizedDevice.findOne({
      userId,
      deviceId,
      isRevoked: false,
    });

    if (matchedDevice) {
      return {
        isRecognized: true,
        isNewDevice: false,
        isNewBrowserOrOS: false,
        deviceRecord: matchedDevice,
      };
    }
  }

  // 2. Fallback: check if the user has ANY active recognized devices
  const userDeviceCount = await RecognizedDevice.countDocuments({
    userId,
    isRevoked: false,
  });

  if (userDeviceCount === 0) {
    // First device ever seen for this user
    return {
      isRecognized: false,
      isFirstDevice: true,
      isNewDevice: true,
      isNewBrowserOrOS: false,
      deviceRecord: null,
    };
  }

  // 3. Check if fingerprint exists across user's other recognized devices
  const existingFingerprint = await RecognizedDevice.findOne({
    userId,
    deviceFingerprint: fingerprint,
    isRevoked: false,
  });

  const isNewBrowserOrOS = !existingFingerprint;

  return {
    isRecognized: false,
    isFirstDevice: false,
    isNewDevice: true,
    isNewBrowserOrOS,
    deviceRecord: null,
  };
}

/**
 * Registers or updates a recognized device upon successful login.
 */
async function registerOrUpdateDevice(userId, {
  deviceId,
  browser = "Unknown Browser",
  operatingSystem = "Unknown OS",
  device = "Desktop",
  userAgent = "",
  ipAddress = "",
  location = {},
}) {
  if (!userId || !deviceId) return null;

  const fingerprint = computeDeviceFingerprint(browser, operatingSystem, device);

  try {
    const existing = await RecognizedDevice.findOne({ userId, deviceId });

    if (existing) {
      existing.lastSeenAt = new Date();
      existing.lastIp = ipAddress;
      existing.lastLocation = {
        country: location.country || "Unknown Country",
        city: location.city || "Unknown City",
      };
      existing.browser = browser;
      existing.operatingSystem = operatingSystem;
      existing.device = device;
      existing.deviceFingerprint = fingerprint;
      existing.isRevoked = false;
      return await existing.save();
    }

    return await RecognizedDevice.create({
      userId,
      deviceId,
      deviceFingerprint: fingerprint,
      browser,
      operatingSystem,
      device,
      userAgent,
      lastSeenAt: new Date(),
      lastIp: ipAddress,
      lastLocation: {
        country: location.country || "Unknown Country",
        city: location.city || "Unknown City",
      },
      isRevoked: false,
      trustLevel: "TRUSTED",
    });
  } catch (err) {
    console.error("[DeviceService] registerOrUpdateDevice error:", err.message);
    return null;
  }
}

/**
 * Returns all active recognized devices for a user.
 */
async function getUserRecognizedDevices(userId, currentDeviceId = "") {
  if (!userId) return [];

  const devices = await RecognizedDevice.find({
    userId,
    isRevoked: false,
  }).sort({ lastSeenAt: -1 });

  return devices.map((d) => ({
    _id: d._id,
    deviceId: d.deviceId,
    browser: d.browser,
    operatingSystem: d.operatingSystem,
    device: d.device,
    firstSeenAt: d.firstSeenAt,
    lastSeenAt: d.lastSeenAt,
    lastLocation: d.lastLocation,
    isCurrent: currentDeviceId ? d.deviceId === currentDeviceId : false,
  }));
}

/**
 * Revokes device recognition and terminates associated sessions.
 */
async function revokeDevice(userId, deviceId) {
  if (!userId || !deviceId) return { success: false, message: "User and device ID required." };

  const updated = await RecognizedDevice.findOneAndUpdate(
    { userId, deviceId },
    { isRevoked: true },
    { new: true }
  );

  // Terminate any active sessions tied to this deviceId
  const sessionResult = await Session.updateMany(
    { user: userId, deviceId },
    { isRevoked: true, isCurrent: false }
  );

  return {
    success: true,
    revoked: !!updated,
    terminatedSessionsCount: sessionResult.modifiedCount || 0,
  };
}

module.exports = {
  computeDeviceFingerprint,
  resolveDeviceId,
  checkDeviceRecognition,
  registerOrUpdateDevice,
  getUserRecognizedDevices,
  revokeDevice,
};
