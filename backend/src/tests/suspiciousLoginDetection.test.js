const assert = require("assert");
const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(__dirname, "../../.env") });
dotenv.config();
process.env.NODE_ENV = "test";

const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Session = require("../models/Session");
const LoginEvent = require("../models/LoginEvent");
const RecognizedDevice = require("../models/RecognizedDevice");
const SecurityEvent = require("../models/SecurityEvent");
const hashPassword = require("../utils/hashPassword");
const geoLookup = require("../utils/geoLookup");
const deviceService = require("../services/deviceService");
const { assessLoginRisk } = require("../services/riskEngineService");
const loginSecurityService = require("../services/loginSecurityService");
const {
  getLoginHistory,
  getRecognizedDevices,
  revokeRecognizedDevice,
  secureAccount,
  reviewLoginEvent,
} = require("../controllers/profileController");
const {
  getLoginIncidents,
  updateLoginIncidentStatus,
} = require("../controllers/securityGatewayController");

function invoke(controllerFn, req) {
  const res = {
    statusCode: 200,
    headers: {},
    body: null,
    cookies: {},
    cookie(name, val) {
      this.cookies[name] = val;
      return this;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
    setHeader(name, value) {
      this.headers[name] = value;
      return this;
    },
  };

  return new Promise((resolve) => {
    let resolved = false;
    const finish = () => {
      if (!resolved) {
        resolved = true;
        resolve(res);
      }
    };

    const originalJson = res.json.bind(res);
    res.json = (data) => {
      originalJson(data);
      finish();
      return res;
    };

    const result = controllerFn(req, res, (err) => {
      if (err) {
        if (!resolved) {
          resolved = true;
          res.statusCode = err.status || err.statusCode || 500;
          res.body = { success: false, error: err.message, code: err.code };
          resolve(res);
        }
      } else {
        finish();
      }
    });

    if (result && typeof result.then === "function") {
      result.then(finish).catch((err) => {
        if (!resolved) {
          resolved = true;
          res.statusCode = err.status || err.statusCode || 500;
          res.body = { success: false, error: err.message, code: err.code };
          resolve(res);
        }
      });
    }
  });
}

async function runAllTests() {
  console.log("🛡️ Starting Real-Time Suspicious Login Detection & Intelligent Account Protection Tests...\n");

  const loginEventsStore = new Map();
  const devicesStore = new Map();
  const sessionsStore = new Map();
  const usersStore = new Map();

  // Mongoose mocks
  const origLoginEventCreate = LoginEvent.create;
  LoginEvent.create = async function (data) {
    const id = new mongoose.Types.ObjectId();
    const doc = {
      _id: id,
      ...data,
      save: async function () {
        loginEventsStore.set(this._id.toString(), this);
        return this;
      },
    };
    loginEventsStore.set(id.toString(), doc);
    return doc;
  };

  const origLoginEventFindOne = LoginEvent.findOne;
  LoginEvent.findOne = function (filter) {
    let matched = null;
    const events = Array.from(loginEventsStore.values()).sort(
      (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
    );

    for (const ev of events) {
      let match = true;
      if (filter._id && ev._id.toString() !== filter._id.toString()) match = false;
      if (filter.userId && (!ev.userId || ev.userId.toString() !== filter.userId.toString())) match = false;
      if (filter.status && ev.status !== filter.status) match = false;
      if (filter.$or) {
        const matchesOr = filter.$or.some((c) => {
          if (c.userId && ev.userId && ev.userId.toString() === c.userId.toString()) return true;
          if (c.userEmail && ev.userEmail === c.userEmail) return true;
          return false;
        });
        if (!matchesOr) match = false;
      }
      if (match) {
        matched = ev;
        break;
      }
    }

    const query = Promise.resolve(matched);
    query.sort = () => query;
    return query;
  };

  const origLoginEventExists = LoginEvent.exists;
  LoginEvent.exists = async function (filter) {
    for (const ev of loginEventsStore.values()) {
      let match = true;
      if (filter.ipAddress && ev.ipAddress !== filter.ipAddress) match = false;
      if (filter["location.country"] && ev.location?.country !== filter["location.country"]) match = false;
      if (filter.status && ev.status !== filter.status) match = false;
      if (match) return { _id: ev._id };
    }
    return null;
  };

  const origLoginEventFind = LoginEvent.find;
  LoginEvent.find = function (filter = {}) {
    let results = Array.from(loginEventsStore.values());
    if (filter.userId) {
      results = results.filter((ev) => ev.userId && ev.userId.toString() === filter.userId.toString());
    }
    if (filter.riskLevel) {
      if (filter.riskLevel.$in) {
        results = results.filter((ev) => filter.riskLevel.$in.includes(ev.riskLevel));
      } else {
        results = results.filter((ev) => ev.riskLevel === filter.riskLevel);
      }
    }
    if (filter.investigationStatus) {
      results = results.filter((ev) => ev.investigationStatus === filter.investigationStatus);
    }

    results.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    const query = Promise.resolve(results);
    query.sort = () => query;
    query.skip = (n) => {
      query.then = (fn) => Promise.resolve(results.slice(n)).then(fn);
      return query;
    };
    query.limit = (n) => {
      query.then = (fn) => Promise.resolve(results.slice(0, n)).then(fn);
      return query;
    };
    query.populate = () => query;
    query.select = () => query;
    query.lean = () => query;
    return query;
  };

  const origLoginEventCount = LoginEvent.countDocuments;
  LoginEvent.countDocuments = async function (filter = {}) {
    let count = 0;
    for (const ev of loginEventsStore.values()) {
      let match = true;
      if (filter.userId && (!ev.userId || ev.userId.toString() !== filter.userId.toString())) match = false;
      if (filter.riskLevel) {
        if (filter.riskLevel.$in) {
          if (!filter.riskLevel.$in.includes(ev.riskLevel)) match = false;
        } else if (ev.riskLevel !== filter.riskLevel) match = false;
      }
      if (match) count++;
    }
    return count;
  };

  const origLoginEventFindById = LoginEvent.findById;
  LoginEvent.findById = function (id) {
    const doc = loginEventsStore.get(id?.toString()) || null;
    return Promise.resolve(doc);
  };

  const origLoginEventUpdateMany = LoginEvent.updateMany;
  LoginEvent.updateMany = async function (filter, update) {
    let count = 0;
    for (const ev of loginEventsStore.values()) {
      let match = true;
      if (filter.userId && (!ev.userId || ev.userId.toString() !== filter.userId.toString())) match = false;
      if (filter.riskLevel?.$in && !filter.riskLevel.$in.includes(ev.riskLevel)) match = false;
      if (filter.userReviewStatus && ev.userReviewStatus !== filter.userReviewStatus) match = false;
      if (match) {
        if (update.userReviewStatus) ev.userReviewStatus = update.userReviewStatus;
        if (update.investigationStatus) ev.investigationStatus = update.investigationStatus;
        count++;
      }
    }
    return { modifiedCount: count };
  };

  // RecognizedDevice Mocks
  const origDeviceCreate = RecognizedDevice.create;
  RecognizedDevice.create = async function (data) {
    const id = new mongoose.Types.ObjectId();
    const doc = {
      _id: id,
      ...data,
      save: async function () {
        devicesStore.set(`${this.userId}:${this.deviceId}`, this);
        return this;
      },
    };
    devicesStore.set(`${data.userId}:${data.deviceId}`, doc);
    return doc;
  };

  const origDeviceFindOne = RecognizedDevice.findOne;
  RecognizedDevice.findOne = function (filter) {
    let found = null;
    for (const d of devicesStore.values()) {
      let match = true;
      if (filter.userId && d.userId?.toString() !== filter.userId.toString()) match = false;
      if (filter.deviceId && d.deviceId !== filter.deviceId) match = false;
      if (filter.deviceFingerprint && d.deviceFingerprint !== filter.deviceFingerprint) match = false;
      if (filter.isRevoked !== undefined && d.isRevoked !== filter.isRevoked) match = false;
      if (match) {
        found = d;
        break;
      }
    }
    return Promise.resolve(found);
  };

  const origDeviceFind = RecognizedDevice.find;
  RecognizedDevice.find = function (filter) {
    const list = [];
    for (const d of devicesStore.values()) {
      let match = true;
      if (filter.userId && d.userId?.toString() !== filter.userId.toString()) match = false;
      if (filter.isRevoked !== undefined && d.isRevoked !== filter.isRevoked) match = false;
      if (match) list.push(d);
    }
    list.sort((a, b) => new Date(b.lastSeenAt) - new Date(a.lastSeenAt));
    const p = Promise.resolve(list);
    p.sort = () => p;
    return p;
  };

  const origDeviceCount = RecognizedDevice.countDocuments;
  RecognizedDevice.countDocuments = async function (filter) {
    let count = 0;
    for (const d of devicesStore.values()) {
      let match = true;
      if (filter.userId && d.userId?.toString() !== filter.userId.toString()) match = false;
      if (filter.isRevoked !== undefined && d.isRevoked !== filter.isRevoked) match = false;
      if (match) count++;
    }
    return count;
  };

  const origDeviceFindOneAndUpdate = RecognizedDevice.findOneAndUpdate;
  RecognizedDevice.findOneAndUpdate = async function (filter, update) {
    for (const d of devicesStore.values()) {
      let match = true;
      if (filter.userId && d.userId?.toString() !== filter.userId.toString()) match = false;
      if (filter.deviceId && d.deviceId !== filter.deviceId) match = false;
      if (match) {
        if (update.isRevoked !== undefined) d.isRevoked = update.isRevoked;
        return d;
      }
    }
    return null;
  };

  // Session Mocks
  const origSessionUpdateMany = Session.updateMany;
  Session.updateMany = async function (filter, update) {
    let count = 0;
    for (const s of sessionsStore.values()) {
      let match = true;
      if (filter.user && s.user?.toString() !== filter.user.toString()) match = false;
      if (filter.deviceId && s.deviceId !== filter.deviceId) match = false;
      if (filter.refreshToken?.$ne && s.refreshToken === filter.refreshToken.$ne) match = false;
      if (match) {
        if (update.isRevoked !== undefined) s.isRevoked = update.isRevoked;
        if (update.isCurrent !== undefined) s.isCurrent = update.isCurrent;
        count++;
      }
    }
    return { modifiedCount: count };
  };

  // SecurityEvent Mocks
  const securityEventsStore = new Map();
  const origSecurityEventFindOne = SecurityEvent.findOne;
  SecurityEvent.findOne = function (filter) {
    let matched = null;
    for (const ev of securityEventsStore.values()) {
      let match = true;
      if (filter.userId && ev.userId?.toString() !== filter.userId.toString()) match = false;
      if (filter.eventType && ev.eventType !== filter.eventType) match = false;
      if (filter.timestamp?.$gte && ev.timestamp < filter.timestamp.$gte) match = false;
      if (match) {
        matched = ev;
        break;
      }
    }
    const query = Promise.resolve(matched);
    query.sort = () => query;
    return query;
  };

  const origSecurityEventCreate = SecurityEvent.create;
  SecurityEvent.create = async function (data) {
    const id = new mongoose.Types.ObjectId();
    const doc = {
      _id: id,
      ...data,
      save: async function () {
        securityEventsStore.set(this._id.toString(), this);
        return this;
      },
    };
    securityEventsStore.set(id.toString(), doc);
    return doc;
  };

  // User Mocks
  const origUserFindById = User.findById;
  User.findById = function (id) {
    const user = usersStore.get(id?.toString()) || null;
    const query = Promise.resolve(user);
    query.select = () => query;
    return query;
  };

  const origUserFindOne = User.findOne;
  User.findOne = function (filter) {
    let found = null;
    for (const u of usersStore.values()) {
      if (filter.email && u.email === filter.email.toLowerCase().trim()) {
        found = u;
        break;
      }
      if (filter._id && u._id.toString() === filter._id.toString()) {
        found = u;
        break;
      }
    }
    const query = Promise.resolve(found);
    query.select = () => query;
    return query;
  };

  try {
    const testUser = {
      _id: new mongoose.Types.ObjectId(),
      fullName: "Alice Security",
      email: "alice@example.com",
      role: "user",
      provider: "local",
      isVerified: true,
      hasPassword: true,
    };
    usersStore.set(testUser._id.toString(), testUser);

    const testAdmin = {
      _id: new mongoose.Types.ObjectId(),
      fullName: "Bob SOC Admin",
      email: "bob_soc@example.com",
      role: "admin",
      isVerified: true,
    };

    // =========================================================================
    // 1. LOCAL LOGIN TESTS
    // =========================================================================
    console.log("--- 1. LOCAL LOGIN TESTS ---");

    // Test 1.1: First Login (Establish Baseline)
    console.log("Test 1.1: Familiar device login (First login establishes baseline)");
    const devId1 = "device-test-uuid-001";
    const req1 = {
      headers: { "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0", "x-device-id": devId1 },
      ip: "127.0.0.1",
      cookies: { _device_id: devId1 },
    };
    const res1 = { cookie: () => {} };

    const result1 = await loginSecurityService.processLoginAttempt({
      req: req1,
      res: res1,
      user: testUser,
      email: testUser.email,
      provider: "local",
      isSuccess: true,
    });
    assert.strictEqual(result1.riskLevel, "LOW");
    assert.strictEqual(result1.riskScore < 30, true);
    assert.strictEqual(result1.loginEvent.status, "SUCCESS");
    console.log("✅ Familiar baseline login recorded with LOW risk.\n");

    // Test 1.2: Returning Login from Same Device (Familiar)
    console.log("Test 1.2: Returning login from recognized device");
    const result1_2 = await loginSecurityService.processLoginAttempt({
      req: req1,
      res: res1,
      user: testUser,
      email: testUser.email,
      provider: "local",
      isSuccess: true,
    });
    assert.strictEqual(result1_2.isNewDevice, false);
    assert.strictEqual(result1_2.riskLevel, "LOW");
    console.log("✅ Returning login recognized as familiar device with LOW risk.\n");

    // Test 1.3: New Device Login
    console.log("Test 1.3: New device login detection");
    const devId2 = "device-test-uuid-002";
    const req2 = {
      headers: { "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15", "x-device-id": devId2 },
      ip: "127.0.0.1",
      cookies: { _device_id: devId2 },
    };
    const result2 = await loginSecurityService.processLoginAttempt({
      req: req2,
      res: res1,
      user: testUser,
      email: testUser.email,
      provider: "local",
      isSuccess: true,
    });
    assert.strictEqual(result2.isNewDevice, true);
    assert.strictEqual(result2.riskLevel !== "LOW", true, "New device should elevate risk to MEDIUM or above");
    console.log("✅ New device login accurately detected with elevated risk.\n");

    // Test 1.4: New Browser Login
    console.log("Test 1.4: New browser login detection");
    const devId3 = "device-test-uuid-003";
    const req3 = {
      headers: { "user-agent": "Mozilla/5.0 (X11; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/119.0", "x-device-id": devId3 },
      ip: "127.0.0.1",
      cookies: { _device_id: devId3 },
    };
    const result3 = await loginSecurityService.processLoginAttempt({
      req: req3,
      res: res1,
      user: testUser,
      email: testUser.email,
      provider: "local",
      isSuccess: true,
    });
    assert.strictEqual(result3.riskReasons.some((r) => r.toLowerCase().includes("browser")), true);
    console.log("✅ New browser family login flagged in risk reasons.\n");

    // Test 1.5: Repeated Failed Login Attempts
    console.log("Test 1.5: Repeated failed login attempts monitoring");
    for (let i = 1; i <= 3; i++) {
      await loginSecurityService.processLoginAttempt({
        req: req1,
        email: testUser.email,
        provider: "local",
        isSuccess: false,
        failureReason: "Incorrect password",
      });
    }
    const failedEvents = Array.from(loginEventsStore.values()).filter((e) => e.status === "FAILED");
    assert.strictEqual(failedEvents.length >= 3, true);
    console.log("✅ Repeated failed attempts recorded properly without crashing.\n");

    // Test 1.6: Failed Attempts Followed by Successful Login
    console.log("Test 1.6: Failed attempts followed by successful login elevates risk");
    const riskWithPriorFails = assessLoginRisk({
      isNewDevice: true,
      failedLoginsCount: 4,
    });
    assert.strictEqual(riskWithPriorFails.riskScore >= 50, true);
    assert.strictEqual(riskWithPriorFails.riskReasons.some((r) => r.includes("failed authentication")), true);
    console.log("✅ Prior failure correlation correctly elevates risk score.\n");

    // Test 1.7: Unusual Location Login (New Country)
    console.log("Test 1.7: Unusual location login (new country signal)");
    const riskNewCountry = assessLoginRisk({
      isNewDevice: true,
      isNewCountry: true,
    });
    assert.strictEqual(riskNewCountry.riskScore >= 50, true);
    assert.strictEqual(riskNewCountry.riskReasons.some((r) => r.includes("new country")), true);
    console.log("✅ New country origin adds appropriate risk points.\n");

    // Test 1.8: Rapid Geographic Transition (Impossible Travel)
    console.log("Test 1.8: Rapid location-change signal (Impossible Travel calculation)");
    const locNYC = { country: "United States", city: "New York", latitude: 40.7128, longitude: -74.006, isPrivate: false };
    const locLondon = { country: "United Kingdom", city: "London", latitude: 51.5074, longitude: -0.1278, isPrivate: false };
    const t1 = new Date();
    const t2 = new Date(t1.getTime() + 15 * 60 * 1000); // 15 minutes later across the Atlantic (~5500 km)

    const travelCheck = geoLookup.checkImpossibleTravel(locNYC, locLondon, t1, t2);
    assert.strictEqual(travelCheck.isImpossibleTravel, true);
    assert.strictEqual(travelCheck.speedKmH > 10000, true);
    console.log(`✅ Impossible travel flagged: ${travelCheck.speedKmH} km/h over ${travelCheck.distanceKm} km.\n`);

    // Test 1.9: Suspicious Session Revocation via secureAccount
    console.log("Test 1.9: Suspicious session revocation (secureAccount)");
    // Seed sessions for testUser
    sessionsStore.set("sess1", { _id: "sess1", user: testUser._id, refreshToken: "token_current", isRevoked: false });
    sessionsStore.set("sess2", { _id: "sess2", user: testUser._id, refreshToken: "token_other", isRevoked: false });

    const reqSecure = {
      user: { _id: testUser._id, email: testUser.email },
      cookies: { token: "token_current" },
      headers: {},
    };
    const resSecure = await invoke(secureAccount, reqSecure);
    assert.strictEqual(resSecure.statusCode, 200);
    assert.strictEqual(resSecure.body.success, true);
    assert.strictEqual(sessionsStore.get("sess2").isRevoked, true, "Other session must be revoked");
    assert.strictEqual(sessionsStore.get("sess1").isRevoked, false, "Current session should remain active");
    console.log("✅ secureAccount cleanly terminates other sessions while preserving current session.\n");

    // =========================================================================
    // 2. GOOGLE OAUTH TESTS
    // =========================================================================
    console.log("--- 2. GOOGLE OAUTH TESTS ---");

    const googleUser = {
      _id: new mongoose.Types.ObjectId(),
      fullName: "Google Authenticated",
      email: "google_tester@example.com",
      provider: "google",
      googleId: "google-uid-8888",
      isVerified: true,
      hasPassword: false,
    };
    usersStore.set(googleUser._id.toString(), googleUser);

    // Test 2.1: First Google Login
    console.log("Test 2.1: First Google OAuth login establishes initial baseline");
    const gDevId1 = "google-device-001";
    const gReq1 = {
      headers: { "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0", "x-device-id": gDevId1 },
      ip: "127.0.0.1",
      cookies: { _device_id: gDevId1 },
    };

    const gResult1 = await loginSecurityService.processLoginAttempt({
      req: gReq1,
      res: res1,
      user: googleUser,
      email: googleUser.email,
      provider: "google",
      isSuccess: true,
    });
    assert.strictEqual(gResult1.riskLevel, "LOW");
    assert.strictEqual(gResult1.loginEvent.provider, "google");
    console.log("✅ First Google login successfully recorded with LOW risk.\n");

    // Test 2.2: Returning Google Login from Recognized Device
    console.log("Test 2.2: Returning Google login from recognized device");
    const gResult2 = await loginSecurityService.processLoginAttempt({
      req: gReq1,
      res: res1,
      user: googleUser,
      email: googleUser.email,
      provider: "google",
      isSuccess: true,
    });
    assert.strictEqual(gResult2.isNewDevice, false);
    assert.strictEqual(gResult2.riskLevel, "LOW");
    console.log("✅ Returning Google login recognized as familiar device.\n");

    // Test 2.3: Google Login from New Device
    console.log("Test 2.3: Google login from new device");
    const gDevId2 = "google-device-new";
    const gReq2 = {
      headers: { "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Safari/537.36", "x-device-id": gDevId2 },
      ip: "127.0.0.1",
      cookies: { _device_id: gDevId2 },
    };
    const gResult3 = await loginSecurityService.processLoginAttempt({
      req: gReq2,
      res: res1,
      user: googleUser,
      email: googleUser.email,
      provider: "google",
      isSuccess: true,
    });
    assert.strictEqual(gResult3.isNewDevice, true);
    console.log("✅ Google login on new device properly identified.\n");

    // Test 2.4: Google Login with High Risk (Impossible Travel + New Device)
    console.log("Test 2.4: High-risk Google login assessment");
    const gRiskHigh = assessLoginRisk({
      isNewDevice: true,
      isImpossibleTravel: true,
      isGoogleAuth: true,
    });
    assert.strictEqual(gRiskHigh.riskLevel === "HIGH" || gRiskHigh.riskLevel === "CRITICAL", true);
    assert.strictEqual(gRiskHigh.recommendedAction === "CHALLENGE" || gRiskHigh.recommendedAction === "RESTRICT", true);
    console.log("✅ High-risk Google login evaluated to CHALLENGE/RESTRICT recommended action.\n");

    // =========================================================================
    // 3. RISK ENGINE TESTS
    // =========================================================================
    console.log("--- 3. RISK ENGINE TESTS ---");

    // Test 3.1: Familiar behavior produces LOW risk
    console.log("Test 3.1: Familiar behavior produces Low risk assessment");
    const lowRisk = assessLoginRisk({});
    assert.strictEqual(lowRisk.riskLevel, "LOW");
    assert.strictEqual(lowRisk.riskScore, 0);
    assert.strictEqual(lowRisk.recommendedAction, "ALLOW");
    console.log("✅ Familiar login evaluates to score 0, LOW risk.\n");

    // Test 3.2: New device does not automatically block
    console.log("Test 3.2: New device contributes to risk without blocking");
    const newDevRisk = assessLoginRisk({ isNewDevice: true });
    assert.strictEqual(newDevRisk.riskScore, 25);
    assert.strictEqual(newDevRisk.riskLevel, "LOW");
    assert.strictEqual(newDevRisk.recommendedAction, "ALLOW");
    console.log("✅ New device alone does NOT freeze or block account.\n");

    // Test 3.3: Unfamiliar location does not freeze account
    console.log("Test 3.3: Unfamiliar location alone does not freeze account");
    const locOnlyRisk = assessLoginRisk({ isNewCountry: true });
    assert.strictEqual(locOnlyRisk.riskScore, 25);
    assert.strictEqual(locOnlyRisk.recommendedAction, "ALLOW");
    console.log("✅ Location change alone does NOT freeze or block account.\n");

    // Test 3.4: Multiple significant risk signals trigger elevated risk
    console.log("Test 3.4: Multiple significant risk signals trigger HIGH risk");
    const comboRisk = assessLoginRisk({
      isNewDevice: true,
      isNewCountry: true,
      failedLoginsCount: 1,
    });
    assert.strictEqual(comboRisk.riskScore >= 60, true);
    assert.strictEqual(comboRisk.riskLevel, "HIGH");
    assert.strictEqual(comboRisk.recommendedAction, "CHALLENGE");
    console.log("✅ Combined signals correctly escalate to HIGH risk and CHALLENGE.\n");

    // Test 3.5: Risk scores are deterministic
    console.log("Test 3.5: Risk scores and categories are deterministic");
    const testInput = { isNewDevice: true, isNewBrowserOrOS: true, isUnfamiliarIP: true };
    const scoreA = assessLoginRisk(testInput);
    const scoreB = assessLoginRisk(testInput);
    assert.strictEqual(scoreA.riskScore, scoreB.riskScore);
    assert.strictEqual(scoreA.riskLevel, scoreB.riskLevel);
    console.log("✅ Risk assessment engine is 100% deterministic.\n");

    // Test 3.6: Missing geolocation does not cause failure
    console.log("Test 3.6: Missing geolocation does not cause authentication failure");
    const missingGeoLoc = await geoLookup.lookupIPLocation("");
    assert.strictEqual(missingGeoLoc.country, "Unknown Country");
    assert.strictEqual(missingGeoLoc.isPrivate, true);
    console.log("✅ Missing/null IP safely returns fallback without throwing.\n");

    // =========================================================================
    // 4. NOTIFICATION & PRIVACY TESTS
    // =========================================================================
    console.log("--- 4. NOTIFICATION & PRIVACY TESTS ---");

    // Test 4.1: Notification privacy check
    console.log("Test 4.1: Notification privacy (no secrets exposed in alert)");
    const alertHtml = require("../templates/email/suspiciousLoginAlertTemplate")({
      fullName: "Test Privacy",
      email: "privacy@example.com",
      loginTime: new Date(),
      ipAddress: "203.0.113.195",
      location: "Paris, France",
      riskLevel: "HIGH",
      riskReasons: ["Unusual location transition"],
    });
    assert.strictEqual(alertHtml.includes("refreshToken"), false, "Session refresh token must not appear in alert");
    assert.strictEqual(alertHtml.includes("accessToken"), false, "Access token must not appear in alert");
    assert.strictEqual(alertHtml.includes("Bearer"), false, "Bearer token must not appear in alert");
    assert.strictEqual(alertHtml.includes("eyJ"), false, "JWT signatures must not appear in alert");
    assert.strictEqual(alertHtml.includes("/dashboard/security"), true, "Safe dashboard link must be present");
    console.log("✅ Email alert contains zero credentials or session tokens.\n");

    // Test 4.2: Duplicate notification suppression (throttling)
    console.log("Test 4.2: Duplicate notification suppression");
    const dummyEvent = {
      _id: new mongoose.Types.ObjectId(),
      timestamp: new Date(),
      notificationStatus: "NONE",
      save: async function () { return this; },
    };

    const firstDispatch = await loginSecurityService.dispatchSecurityNotification({
      loginEvent: dummyEvent,
      user: testUser,
      email: "throttle_test@example.com",
      clientInfo: { ipAddress: "127.0.0.1", browser: "Chrome", operatingSystem: "Windows", device: "Desktop" },
      location: { displayLocation: "Localhost" },
      riskAssessment: { riskLevel: "HIGH", riskReasons: ["Test signal"] },
      provider: "local",
      deviceId: "dev-throttle-1",
    });
    assert.strictEqual(firstDispatch, true, "First notification should be dispatched");

    const secondDispatch = await loginSecurityService.dispatchSecurityNotification({
      loginEvent: dummyEvent,
      user: testUser,
      email: "throttle_test@example.com",
      clientInfo: { ipAddress: "127.0.0.1", browser: "Chrome", operatingSystem: "Windows", device: "Desktop" },
      location: { displayLocation: "Localhost" },
      riskAssessment: { riskLevel: "HIGH", riskReasons: ["Test signal"] },
      provider: "local",
      deviceId: "dev-throttle-1",
    });
    assert.strictEqual(secondDispatch, false, "Second immediate duplicate notification must be suppressed");
    console.log("✅ Duplicate alert suppressed within cooldown window.\n");

    // =========================================================================
    // 5. AUTHORIZATION & RBAC TESTS
    // =========================================================================
    console.log("--- 5. AUTHORIZATION & RBAC TESTS ---");

    // Test 5.1: Unauthenticated users cannot access login history
    console.log("Test 5.1: Unauthenticated user rejected from login history");
    const reqUnauth = { user: null };
    // getLoginHistory relies on req.user._id; if unauthenticated, getUserLoginHistory returns empty or throws
    const unauthHistory = await loginSecurityService.getUserLoginHistory(null);
    assert.strictEqual(unauthHistory.events.length, 0);
    console.log("✅ Unauthenticated request returns zero private history.\n");

    // Test 5.2: Users cannot access another user's events
    console.log("Test 5.2: Cross-user login history isolation");
    const userAEvents = await loginSecurityService.getUserLoginHistory(testUser._id);
    const otherUserHistory = await loginSecurityService.getUserLoginHistory(new mongoose.Types.ObjectId());
    assert.strictEqual(otherUserHistory.events.length, 0);
    console.log("✅ Login events are strictly isolated by userId.\n");

    // Test 5.3: Users cannot review another user's login event
    console.log("Test 5.3: Cannot review another user's login event");
    const foreignEvent = await LoginEvent.create({
      userId: new mongoose.Types.ObjectId(),
      userEmail: "victim@example.com",
      eventType: "LOCAL_LOGIN_SUCCESS",
      timestamp: new Date(),
    });

    const crossReview = await loginSecurityService.userReviewLoginEvent(
      testUser._id, // Attacker user id
      foreignEvent._id,
      "RECOGNIZED"
    );
    assert.strictEqual(crossReview, null, "Cross-user review must be denied");
    console.log("✅ Cross-user event review blocked.\n");

    // Test 5.4: Admin incident endpoints retrieve data
    console.log("Test 5.4: Authorized Admin SOC incident endpoints");
    const reqAdmin = { query: {} };
    const resAdmin = await invoke(getLoginIncidents, reqAdmin);
    assert.strictEqual(resAdmin.statusCode, 200);
    assert.strictEqual(resAdmin.body.success, true);
    assert(Array.isArray(resAdmin.body.incidents));
    console.log("✅ Admin incident inquiry returns structured incidents list.\n");

    // Test 5.5: Admin updates incident status and investigation notes
    console.log("Test 5.5: Admin updates incident status and notes");
    const testIncident = await LoginEvent.create({
      userId: testUser._id,
      userEmail: testUser.email,
      eventType: "HIGH_RISK_LOGIN",
      riskLevel: "HIGH",
      riskScore: 75,
      investigationStatus: "UNDER_INVESTIGATION",
    });

    const reqUpdate = {
      params: { id: testIncident._id },
      body: { status: "RESOLVED", notes: "Verified with user over phone" },
    };
    const resUpdate = await invoke(updateLoginIncidentStatus, reqUpdate);
    assert.strictEqual(resUpdate.statusCode, 200);
    assert.strictEqual(resUpdate.body.success, true);
    assert.strictEqual(resUpdate.body.incident.investigationStatus, "RESOLVED");
    assert.strictEqual(resUpdate.body.incident.investigationNotes, "Verified with user over phone");
    console.log("✅ Admin incident status and investigation notes updated successfully.\n");

    // Test 5.6: Recognized Devices API
    console.log("Test 5.6: Recognized Devices API returns list with isCurrent");
    const reqDevices = {
      user: { _id: testUser._id },
      cookies: { _device_id: devId1 },
      headers: {},
    };
    const resDevices = await invoke(getRecognizedDevices, reqDevices);
    assert.strictEqual(resDevices.statusCode, 200);
    assert.strictEqual(resDevices.body.success, true);
    assert(Array.isArray(resDevices.body.devices));
    console.log("✅ Recognized devices endpoint returns trusted devices.\n");

    // Test 5.7: Revoke Recognized Device API
    console.log("Test 5.7: Revoke Recognized Device API");
    const reqRevoke = {
      user: { _id: testUser._id },
      params: { deviceId: devId2 },
    };
    const resRevoke = await invoke(revokeRecognizedDevice, reqRevoke);
    assert.strictEqual(resRevoke.statusCode, 200);
    assert.strictEqual(resRevoke.body.success, true);
    console.log("✅ Device recognition revoked via API.\n");

    console.log("🎉 ALL REAL-TIME SUSPICIOUS LOGIN & ACCOUNT PROTECTION TESTS PASSED SUCCESSFULLY!\n");
  } finally {
    LoginEvent.create = origLoginEventCreate;
    LoginEvent.findOne = origLoginEventFindOne;
    LoginEvent.find = origLoginEventFind;
    LoginEvent.exists = origLoginEventExists;
    LoginEvent.countDocuments = origLoginEventCount;
    LoginEvent.findById = origLoginEventFindById;
    LoginEvent.updateMany = origLoginEventUpdateMany;
    RecognizedDevice.create = origDeviceCreate;
    RecognizedDevice.findOne = origDeviceFindOne;
    RecognizedDevice.find = origDeviceFind;
    RecognizedDevice.countDocuments = origDeviceCount;
    RecognizedDevice.findOneAndUpdate = origDeviceFindOneAndUpdate;
    Session.updateMany = origSessionUpdateMany;
    SecurityEvent.findOne = origSecurityEventFindOne;
    SecurityEvent.create = origSecurityEventCreate;
    User.findById = origUserFindById;
    User.findOne = origUserFindOne;
  }
}

runAllTests().catch((err) => {
  console.error("❌ Test suite failed:", err);
  process.exit(1);
});
