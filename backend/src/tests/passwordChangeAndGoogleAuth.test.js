const assert = require("assert");
const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(__dirname, "../../.env") });
dotenv.config();
process.env.NODE_ENV = "test";

const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const User = require("../models/User");
const OTP = require("../models/OTP");
const Session = require("../models/Session");
const hashPassword = require("../utils/hashPassword");
const comparePassword = require("../utils/comparePassword");
const hashOTP = require("../utils/hashOTP");
const {
  requestChangePasswordOTP,
  verifyChangePasswordOTP,
  changeUserPassword,
} = require("../controllers/profileController");

function invoke(controllerFn, req) {
  const res = {
    statusCode: 200,
    headers: {},
    body: null,
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

async function runTests() {
  console.log("🧪 Starting Comprehensive Password Change & Google OAuth Test Suite...\n");

  const JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-key-min-32-chars-ok";

  const usersStore = new Map();
  const otpsStore = new Map();
  const sessionsStore = new Map();

  const originalUserFindById = User.findById;
  User.findById = function (id) {
    const user = usersStore.get(id?.toString());
    const query = Promise.resolve(user || null);
    query.select = () => query;
    return query;
  };

  const originalUserFindOne = User.findOne;
  User.findOne = function (criteria) {
    let match = null;
    for (const u of usersStore.values()) {
      if (criteria.email && u.email === criteria.email.toLowerCase().trim()) {
        match = u;
        break;
      }
      if (criteria.googleId && u.googleId === criteria.googleId) {
        match = u;
        break;
      }
    }
    const query = Promise.resolve(match || null);
    query.select = () => query;
    return query;
  };

  const originalOTPFindOne = OTP.findOne;
  OTP.findOne = function (criteria) {
    let match = null;
    for (const otp of otpsStore.values()) {
      let matchesUser = true;
      if (criteria.user) {
        matchesUser = otp.user?.toString() === criteria.user.toString();
      }
      let matchesEmail = true;
      if (criteria.email) {
        matchesEmail = otp.email === criteria.email;
      }
      let matchesType = true;
      if (criteria.type) {
        if (criteria.type.$in) {
          matchesType = criteria.type.$in.includes(otp.type);
        } else {
          matchesType = otp.type === criteria.type;
        }
      }
      let matchesVerified = true;
      if (criteria.verified !== undefined) {
        matchesVerified = otp.verified === criteria.verified;
      }

      if (matchesUser && matchesEmail && matchesType && matchesVerified) {
        match = otp;
        break;
      }
    }
    const query = Promise.resolve(match || null);
    query.sort = () => query;
    return query;
  };

  const originalOTPFindById = OTP.findById;
  OTP.findById = function (id) {
    const otp = otpsStore.get(id?.toString());
    return Promise.resolve(otp || null);
  };

  const originalOTPFindByIdAndUpdate = OTP.findByIdAndUpdate;
  OTP.findByIdAndUpdate = async function (id, update) {
    const otp = otpsStore.get(id?.toString());
    if (!otp) return null;
    if (update.$inc && update.$inc.attempts) {
      otp.attempts = (otp.attempts || 0) + update.$inc.attempts;
    }
    if (update.verified !== undefined) {
      otp.verified = update.verified;
    }
    otpsStore.set(id.toString(), otp);
    return otp;
  };

  const originalOTPCreate = OTP.create;
  OTP.create = async function (data) {
    const id = new mongoose.Types.ObjectId();
    const otpDoc = {
      _id: id,
      ...data,
      attempts: data.attempts || 0,
      verified: data.verified || false,
      save: async function () {
        otpsStore.set(this._id.toString(), this);
        return this;
      },
    };
    otpsStore.set(id.toString(), otpDoc);
    return otpDoc;
  };

  const originalOTPDeleteMany = OTP.deleteMany;
  OTP.deleteMany = async function (filter) {
    for (const [id, otp] of Array.from(otpsStore.entries())) {
      let matchesUser = true;
      if (filter.user) {
        matchesUser = otp.user?.toString() === filter.user.toString();
      }
      let matchesEmail = true;
      if (filter.email) {
        matchesEmail = otp.email === filter.email;
      }
      let matchesType = true;
      if (filter.type) {
        if (filter.type.$in) {
          matchesType = filter.type.$in.includes(otp.type);
        } else {
          matchesType = otp.type === filter.type;
        }
      }
      if (matchesUser && matchesEmail && matchesType) {
        otpsStore.delete(id);
      }
    }
    return { acknowledged: true, deletedCount: 1 };
  };

  const originalSessionUpdateMany = Session.updateMany;
  Session.updateMany = async function (filter, update) {
    for (const session of sessionsStore.values()) {
      if (filter.user && session.user?.toString() === filter.user.toString()) {
        if (update.isRevoked !== undefined) session.isRevoked = update.isRevoked;
        if (update.isCurrent !== undefined) session.isCurrent = update.isCurrent;
      }
    }
    return { acknowledged: true };
  };

  try {
    // -------------------------------------------------------------
    // Scenario 1: Local signup user requests OTP and changes password without currentPassword
    // -------------------------------------------------------------
    console.log("Scenario 1: Local signup user requests OTP and changes password without currentPassword");
    const localUser = {
      _id: new mongoose.Types.ObjectId(),
      fullName: "Local User",
      email: "local@example.com",
      provider: "local",
      isVerified: true,
      hasPassword: true,
      password: await hashPassword("OldPassword@123"),
      refreshToken: "token123",
      save: async function () {
        usersStore.set(this._id.toString(), this);
        return this;
      },
    };
    usersStore.set(localUser._id.toString(), localUser);

    // 1a. Request OTP
    const res1a = await invoke(requestChangePasswordOTP, {
      user: { _id: localUser._id, email: localUser.email, role: "user" },
      ip: "127.0.0.1",
      headers: {},
    });
    assert.strictEqual(res1a.statusCode, 200, "Local user should receive OTP successfully");
    assert.strictEqual(res1a.body.success, true);
    assert.strictEqual(res1a.body.isSettingPassword, false);
    assert.strictEqual(res1a.body.maskedEmail, "lo***l@example.com");

    // Retrieve created OTP and set known OTP
    const createdOtpDoc1 = Array.from(otpsStore.values()).find(
      (o) => o.user.toString() === localUser._id.toString() && !o.verified
    );
    assert(createdOtpDoc1, "OTP document should exist in store");
    const testOtpRaw = "481920";
    createdOtpDoc1.otp = await hashOTP(testOtpRaw);

    // 1b. Verify OTP
    const res1b = await invoke(verifyChangePasswordOTP, {
      user: { _id: localUser._id, email: localUser.email },
      body: { otp: testOtpRaw },
      ip: "127.0.0.1",
      headers: {},
    });
    assert.strictEqual(res1b.statusCode, 200, "OTP verification should succeed");
    assert.strictEqual(res1b.body.success, true);
    assert(res1b.body.resetToken, "resetToken should be issued");
    const localResetToken = res1b.body.resetToken;

    // 1c. Change password (WITHOUT currentPassword!)
    const res1c = await invoke(changeUserPassword, {
      user: { _id: localUser._id, email: localUser.email },
      body: {
        newPassword: "NewSecurePassword@2026",
        confirmPassword: "NewSecurePassword@2026",
        resetToken: localResetToken,
      },
      ip: "127.0.0.1",
      headers: {},
    });
    assert.strictEqual(res1c.statusCode, 200, "Password change should succeed without currentPassword");
    assert.strictEqual(res1c.body.success, true);

    const isNewPasswordValid = await comparePassword("NewSecurePassword@2026", localUser.password);
    assert.strictEqual(isNewPasswordValid, true, "New password must verify via bcrypt");
    assert.strictEqual(localUser.refreshToken, "", "User refreshToken must be cleared");
    console.log("✅ Local signup user successfully changed password without currentPassword.\n");

    // -------------------------------------------------------------
    // Scenario 2: Google OAuth user requests OTP and sets first password
    // -------------------------------------------------------------
    console.log("Scenario 2: Google OAuth user requests OTP and sets first password");
    const googleUser = {
      _id: new mongoose.Types.ObjectId(),
      fullName: "Google Only User",
      email: "googleuser@example.com",
      provider: "google",
      googleId: "google-uid-1001",
      isVerified: true,
      hasPassword: false,
      password: "",
      refreshToken: "token-google",
      save: async function () {
        usersStore.set(this._id.toString(), this);
        return this;
      },
    };
    usersStore.set(googleUser._id.toString(), googleUser);

    // 2a. Request OTP (previously rejected with 'Only local accounts can request password change OTP')
    const res2a = await invoke(requestChangePasswordOTP, {
      user: { _id: googleUser._id, email: googleUser.email, role: "user" },
      ip: "127.0.0.1",
      headers: {},
    });
    assert.strictEqual(res2a.statusCode, 200, "Google OAuth user should be permitted to request OTP");
    assert.strictEqual(res2a.body.success, true);
    assert.strictEqual(res2a.body.isSettingPassword, true);

    // 2b. Verify OTP
    const googleOtpDoc = Array.from(otpsStore.values()).find(
      (o) => o.user.toString() === googleUser._id.toString() && !o.verified
    );
    googleOtpDoc.otp = await hashOTP("654321");

    const res2b = await invoke(verifyChangePasswordOTP, {
      user: { _id: googleUser._id, email: googleUser.email },
      body: { otp: "654321" },
      ip: "127.0.0.1",
      headers: {},
    });
    assert.strictEqual(res2b.statusCode, 200);
    const googleResetToken = res2b.body.resetToken;

    // 2c. Set first password
    const res2c = await invoke(changeUserPassword, {
      user: { _id: googleUser._id, email: googleUser.email },
      body: {
        newPassword: "GoogleUserPassword@2026",
        confirmPassword: "GoogleUserPassword@2026",
        resetToken: googleResetToken,
      },
      ip: "127.0.0.1",
      headers: {},
    });
    assert.strictEqual(res2c.statusCode, 200);
    assert.strictEqual(googleUser.hasPassword, true, "hasPassword should now be true");
    assert.strictEqual(googleUser.googleId, "google-uid-1001", "googleId must be preserved");
    assert.strictEqual(googleUser.provider, "google", "provider must be preserved");
    console.log("✅ Google OAuth user successfully requested OTP and established first password.\n");

    // -------------------------------------------------------------
    // Scenario 3: Google OAuth user with existing password changes it
    // -------------------------------------------------------------
    console.log("Scenario 3: Google OAuth user with existing password changes it");
    const res3a = await invoke(requestChangePasswordOTP, {
      user: { _id: googleUser._id, email: googleUser.email, role: "user" },
      ip: "127.0.0.1",
      headers: {},
    });
    assert.strictEqual(res3a.statusCode, 200);
    assert.strictEqual(res3a.body.isSettingPassword, false, "Now has password, so isSettingPassword is false");

    const googleOtpDoc2 = Array.from(otpsStore.values()).find(
      (o) => o.user.toString() === googleUser._id.toString() && !o.verified
    );
    googleOtpDoc2.otp = await hashOTP("998877");

    const res3b = await invoke(verifyChangePasswordOTP, {
      user: { _id: googleUser._id, email: googleUser.email },
      body: { otp: "998877" },
      ip: "127.0.0.1",
      headers: {},
    });
    assert.strictEqual(res3b.statusCode, 200);

    const res3c = await invoke(changeUserPassword, {
      user: { _id: googleUser._id, email: googleUser.email },
      body: {
        newPassword: "UpdatedGooglePass@2026",
        confirmPassword: "UpdatedGooglePass@2026",
        resetToken: res3b.body.resetToken,
      },
      ip: "127.0.0.1",
      headers: {},
    });
    assert.strictEqual(res3c.statusCode, 200);
    const passCheck = await comparePassword("UpdatedGooglePass@2026", googleUser.password);
    assert.strictEqual(passCheck, true);
    console.log("✅ Google OAuth user with existing password successfully updated password.\n");

    // -------------------------------------------------------------
    // Scenario 4: Linked Google and local account changes password without creating duplicates
    // -------------------------------------------------------------
    console.log("Scenario 4: Linked Google and local account changes password without creating duplicates");
    const initialUserCount = usersStore.size;
    const linkedUser = {
      _id: new mongoose.Types.ObjectId(),
      fullName: "Linked Account",
      email: "linked@example.com",
      provider: "google",
      googleId: "google-linked-777",
      isVerified: true,
      hasPassword: true,
      password: await hashPassword("OldLinkedPass@123"),
      refreshToken: "linked_token",
      save: async function () {
        usersStore.set(this._id.toString(), this);
        return this;
      },
    };
    usersStore.set(linkedUser._id.toString(), linkedUser);

    const res4a = await invoke(requestChangePasswordOTP, {
      user: { _id: linkedUser._id, email: linkedUser.email, role: "user" },
      ip: "127.0.0.1",
      headers: {},
    });
    assert.strictEqual(res4a.statusCode, 200);

    const linkedOtpDoc = Array.from(otpsStore.values()).find(
      (o) => o.user.toString() === linkedUser._id.toString() && !o.verified
    );
    linkedOtpDoc.otp = await hashOTP("112233");

    const res4b = await invoke(verifyChangePasswordOTP, {
      user: { _id: linkedUser._id, email: linkedUser.email },
      body: { otp: "112233" },
      ip: "127.0.0.1",
      headers: {},
    });
    assert.strictEqual(res4b.statusCode, 200);

    const res4c = await invoke(changeUserPassword, {
      user: { _id: linkedUser._id, email: linkedUser.email },
      body: {
        newPassword: "BrandNewLinkedPass@2026",
        confirmPassword: "BrandNewLinkedPass@2026",
        resetToken: res4b.body.resetToken,
      },
      ip: "127.0.0.1",
      headers: {},
    });
    assert.strictEqual(res4c.statusCode, 200);
    assert.strictEqual(usersStore.size, initialUserCount + 1, "No duplicate user record was created");
    console.log("✅ Linked Google & local account changed password cleanly without duplicating account.\n");

    // -------------------------------------------------------------
    // Scenario 5: Unauthenticated user rejected
    // -------------------------------------------------------------
    console.log("Scenario 5: Unauthenticated user rejected");
    const res5a = await invoke(requestChangePasswordOTP, { user: null, ip: "127.0.0.1", headers: {} });
    assert.strictEqual(res5a.statusCode, 401, "Unauthenticated user must receive 401");

    const res5b = await invoke(verifyChangePasswordOTP, { user: null, body: { otp: "123456" }, ip: "127.0.0.1", headers: {} });
    assert.strictEqual(res5b.statusCode, 401);

    const res5c = await invoke(changeUserPassword, { user: null, body: { newPassword: "Pass@1234567" }, ip: "127.0.0.1", headers: {} });
    assert.strictEqual(res5c.statusCode, 401);
    console.log("✅ Unauthenticated requests correctly rejected with 401.\n");

    // -------------------------------------------------------------
    // Scenario 6: Unverified email rejected
    // -------------------------------------------------------------
    console.log("Scenario 6: Unverified email rejected (returns HTTP 403 EMAIL_UNVERIFIED)");
    const unverifiedUser = {
      _id: new mongoose.Types.ObjectId(),
      fullName: "Unverified User",
      email: "unverified@example.com",
      provider: "local",
      isVerified: false,
      hasPassword: true,
      password: "somehashvalue",
      save: async function () {
        usersStore.set(this._id.toString(), this);
        return this;
      },
    };
    usersStore.set(unverifiedUser._id.toString(), unverifiedUser);

    const res6 = await invoke(requestChangePasswordOTP, {
      user: { _id: unverifiedUser._id, email: unverifiedUser.email, role: "user" },
      ip: "127.0.0.1",
      headers: {},
    });
    assert.strictEqual(res6.statusCode, 403, "Unverified email must return HTTP 403");
    assert.strictEqual(res6.body.code, "EMAIL_UNVERIFIED");
    console.log("✅ Unverified email rejected with 403 EMAIL_UNVERIFIED.\n");

    // -------------------------------------------------------------
    // Scenario 7: Incorrect OTP rejected and attempts incremented
    // -------------------------------------------------------------
    console.log("Scenario 7: Incorrect OTP rejected and attempts incremented");
    const testOtp7 = await OTP.create({
      user: localUser._id,
      email: localUser.email,
      otp: await hashOTP("123456"),
      type: "CHANGE_PASSWORD",
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      attempts: 0,
      verified: false,
    });

    const res7a = await invoke(verifyChangePasswordOTP, {
      user: { _id: localUser._id, email: localUser.email },
      body: { otp: "999999" }, // wrong OTP
      ip: "127.0.0.1",
      headers: {},
    });
    assert.strictEqual(res7a.statusCode, 400, "Wrong OTP must return 400");
    assert.strictEqual(testOtp7.attempts, 1, "OTP attempts must be incremented");

    // 7b. Max attempts exceeded
    testOtp7.attempts = 5;
    const res7b = await invoke(verifyChangePasswordOTP, {
      user: { _id: localUser._id, email: localUser.email },
      body: { otp: "999999" },
      ip: "127.0.0.1",
      headers: {},
    });
    assert.strictEqual(res7b.statusCode, 400, "Max attempts reached must be rejected");
    console.log("✅ Incorrect OTP rejected and attempts properly tracked and capped.\n");

    // -------------------------------------------------------------
    // Scenario 8: Expired OTP rejected
    // -------------------------------------------------------------
    console.log("Scenario 8: Expired OTP rejected");
    await OTP.create({
      user: localUser._id,
      email: localUser.email,
      otp: await hashOTP("555555"),
      type: "CHANGE_PASSWORD",
      expiresAt: new Date(Date.now() - 10000), // expired 10s ago
      attempts: 0,
      verified: false,
    });

    const res8 = await invoke(verifyChangePasswordOTP, {
      user: { _id: localUser._id, email: localUser.email },
      body: { otp: "555555" },
      ip: "127.0.0.1",
      headers: {},
    });
    assert.strictEqual(res8.statusCode, 400, "Expired OTP must return 400");
    assert(res8.body.message.toLowerCase().includes("expired"));
    console.log("✅ Expired OTP correctly rejected.\n");

    // -------------------------------------------------------------
    // Scenario 9: Reused OTP rejected
    // -------------------------------------------------------------
    console.log("Scenario 9: Reused OTP rejected");
    await OTP.create({
      user: localUser._id,
      email: localUser.email,
      otp: await hashOTP("666666"),
      type: "CHANGE_PASSWORD",
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      attempts: 1,
      verified: true, // already verified
    });

    const res9 = await invoke(verifyChangePasswordOTP, {
      user: { _id: localUser._id, email: localUser.email },
      body: { otp: "666666" },
      ip: "127.0.0.1",
      headers: {},
    });
    assert.strictEqual(res9.statusCode, 400, "Reused / already verified OTP must return 400");
    console.log("✅ Reused OTP correctly rejected.\n");

    // -------------------------------------------------------------
    // Scenario 10: User cannot change another user's password (token user mismatch)
    // -------------------------------------------------------------
    console.log("Scenario 10: User cannot change another user's password (token user mismatch)");
    const victimUser = {
      _id: new mongoose.Types.ObjectId(),
      fullName: "Victim",
      email: "victim@example.com",
      provider: "local",
      isVerified: true,
      hasPassword: true,
      password: "victim_password_hash",
      save: async function () {
        usersStore.set(this._id.toString(), this);
        return this;
      },
    };
    usersStore.set(victimUser._id.toString(), victimUser);

    const attackerUser = {
      _id: new mongoose.Types.ObjectId(),
      fullName: "Attacker",
      email: "attacker@example.com",
      provider: "local",
      isVerified: true,
      hasPassword: true,
      password: "attacker_password_hash",
      save: async function () {
        usersStore.set(this._id.toString(), this);
        return this;
      },
    };
    usersStore.set(attackerUser._id.toString(), attackerUser);

    const victimOtpDoc = await OTP.create({
      user: victimUser._id,
      email: victimUser.email,
      otp: "hashed",
      type: "CHANGE_PASSWORD",
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      verified: true,
    });
    const victimResetToken = jwt.sign(
      { userId: victimUser._id.toString(), email: victimUser.email, purpose: "PASSWORD_CHANGE", otpId: victimOtpDoc._id.toString() },
      JWT_SECRET,
      { expiresIn: "10m" }
    );

    const res10 = await invoke(changeUserPassword, {
      user: { _id: attackerUser._id, email: attackerUser.email },
      body: {
        newPassword: "AttackerTakeoverPass@123",
        confirmPassword: "AttackerTakeoverPass@123",
        resetToken: victimResetToken,
      },
      ip: "127.0.0.1",
      headers: {},
    });
    assert.strictEqual(res10.statusCode, 403, "Token user mismatch must return 403 Forbidden");
    assert.strictEqual(victimUser.password, "victim_password_hash", "Victim password must NOT be modified");
    console.log("✅ Cross-account token hijacking attempt blocked with 403.\n");

    // -------------------------------------------------------------
    // Scenario 11: Token bypass attempt rejected
    // -------------------------------------------------------------
    console.log("Scenario 11: Token bypass attempt rejected");
    const res11a = await invoke(changeUserPassword, {
      user: { _id: localUser._id, email: localUser.email },
      body: {
        newPassword: "BypassPassword@123",
        confirmPassword: "BypassPassword@123",
      },
      ip: "127.0.0.1",
      headers: {},
    });
    assert.strictEqual(res11a.statusCode, 400, "Missing resetToken must be rejected");

    const res11b = await invoke(changeUserPassword, {
      user: { _id: localUser._id, email: localUser.email },
      body: {
        newPassword: "BypassPassword@123",
        confirmPassword: "BypassPassword@123",
        resetToken: "forged.fake.token",
      },
      ip: "127.0.0.1",
      headers: {},
    });
    assert.strictEqual(res11b.statusCode, 400, "Forged resetToken must be rejected");
    console.log("✅ Token bypass and forgery attempts safely rejected.\n");

    // -------------------------------------------------------------
    // Scenario 12: Reusing authorization token rejected
    // -------------------------------------------------------------
    console.log("Scenario 12: Reusing authorization token rejected");
    const res12 = await invoke(changeUserPassword, {
      user: { _id: localUser._id, email: localUser.email },
      body: {
        newPassword: "AnotherNewPassword@2026",
        confirmPassword: "AnotherNewPassword@2026",
        resetToken: localResetToken,
      },
      ip: "127.0.0.1",
      headers: {},
    });
    assert.strictEqual(res12.statusCode, 400, "Consumed resetToken cannot be reused");
    console.log("✅ Reusing consumed authorization token successfully rejected.\n");

    // -------------------------------------------------------------
    // Scenario 13: Mismatched passwords rejected
    // -------------------------------------------------------------
    console.log("Scenario 13: Mismatched passwords rejected");
    const validOtpDoc13 = await OTP.create({
      user: localUser._id,
      email: localUser.email,
      otp: "hashed",
      type: "CHANGE_PASSWORD",
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      verified: true,
    });
    const freshToken13 = jwt.sign(
      { userId: localUser._id.toString(), email: localUser.email, purpose: "PASSWORD_CHANGE", otpId: validOtpDoc13._id.toString() },
      JWT_SECRET,
      { expiresIn: "10m" }
    );

    const res13 = await invoke(changeUserPassword, {
      user: { _id: localUser._id, email: localUser.email },
      body: {
        newPassword: "Password123!",
        confirmPassword: "DifferentPassword123!",
        resetToken: freshToken13,
      },
      ip: "127.0.0.1",
      headers: {},
    });
    assert.strictEqual(res13.statusCode, 400, "Mismatched passwords must return 400");
    assert(res13.body.message.toLowerCase().includes("match"));
    console.log("✅ Mismatched passwords correctly rejected.\n");

    // -------------------------------------------------------------
    // Scenario 14: Google login still works after setting password
    // -------------------------------------------------------------
    console.log("Scenario 14: Google login still works after setting password");
    assert.strictEqual(googleUser.googleId, "google-uid-1001");
    assert.strictEqual(googleUser.provider, "google");
    assert.strictEqual(googleUser.hasPassword, true);

    const foundByGoogle = await User.findOne({ googleId: "google-uid-1001" });
    assert.strictEqual(foundByGoogle.email, googleUser.email);
    console.log("✅ Google login compatibility intact: googleId and provider preserved after setting password.\n");

    // -------------------------------------------------------------
    // Scenario 15: Email+password login works with newly established password
    // -------------------------------------------------------------
    console.log("Scenario 15: Email+password login works with newly established password");
    const userForLogin = await User.findOne({ email: googleUser.email });
    assert(userForLogin, "User should be found by email");
    assert(userForLogin.password, "User has password hash");
    const passwordMatches = await comparePassword("UpdatedGooglePass@2026", userForLogin.password);
    assert.strictEqual(passwordMatches, true, "New password verifies against user password hash");
    const wrongPasswordMatches = await comparePassword("WrongPassword@123", userForLogin.password);
    assert.strictEqual(wrongPasswordMatches, false, "Wrong password rejected");
    console.log("✅ Email + password login successfully verifies newly established password.\n");

    // -------------------------------------------------------------
    // Scenario 16: Sessions are revoked on password update
    // -------------------------------------------------------------
    console.log("Scenario 16: Sessions are revoked on password update");
    const sessionUser = {
      _id: new mongoose.Types.ObjectId(),
      fullName: "Session User",
      email: "sessionuser@example.com",
      provider: "local",
      isVerified: true,
      hasPassword: true,
      password: await hashPassword("OldPass@123"),
      refreshToken: "active_refresh_token_123",
      save: async function () {
        usersStore.set(this._id.toString(), this);
        return this;
      },
    };
    usersStore.set(sessionUser._id.toString(), sessionUser);

    const sess1 = { _id: "s1", user: sessionUser._id, isRevoked: false, isCurrent: true };
    const sess2 = { _id: "s2", user: sessionUser._id, isRevoked: false, isCurrent: false };
    sessionsStore.set("s1", sess1);
    sessionsStore.set("s2", sess2);

    const validOtpDoc16 = await OTP.create({
      user: sessionUser._id,
      email: sessionUser.email,
      otp: "hashed",
      type: "CHANGE_PASSWORD",
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      verified: true,
    });
    const freshToken16 = jwt.sign(
      { userId: sessionUser._id.toString(), email: sessionUser.email, purpose: "PASSWORD_CHANGE", otpId: validOtpDoc16._id.toString() },
      JWT_SECRET,
      { expiresIn: "10m" }
    );

    const res16 = await invoke(changeUserPassword, {
      user: { _id: sessionUser._id, email: sessionUser.email },
      body: {
        newPassword: "BrandNewPass@2026",
        confirmPassword: "BrandNewPass@2026",
        resetToken: freshToken16,
      },
      ip: "127.0.0.1",
      headers: {},
    });
    assert.strictEqual(res16.statusCode, 200);
    assert.strictEqual(sessionUser.refreshToken, "", "User refreshToken must be wiped");
    assert.strictEqual(sess1.isRevoked, true, "Session 1 must be marked revoked");
    assert.strictEqual(sess2.isRevoked, true, "Session 2 must be marked revoked");
    console.log("✅ All sessions revoked and user refreshToken cleared upon password change.\n");

    // -------------------------------------------------------------
    // Scenario 17: Masked email format verification
    // -------------------------------------------------------------
    console.log("Scenario 17: Masked email format verification");
    const testEmails = [
      { input: "john.doe@example.com", prefix: "jo" },
      { input: "a@domain.com", prefix: "a" },
      { input: "alex@domain.com", prefix: "al" },
    ];
    for (const { input, prefix } of testEmails) {
      const u = {
        _id: new mongoose.Types.ObjectId(),
        fullName: "Test",
        email: input,
        isVerified: true,
        hasPassword: true,
      };
      usersStore.set(u._id.toString(), u);
      const resMask = await invoke(requestChangePasswordOTP, {
        user: { _id: u._id, email: u.email, role: "user" },
        ip: "127.0.0.1",
        headers: {},
      });
      assert(resMask.body.maskedEmail.includes("***"), `Masked email should hide characters: ${resMask.body.maskedEmail}`);
      assert(resMask.body.maskedEmail.includes("@"), "Masked email should keep domain");
      assert(resMask.body.maskedEmail.startsWith(prefix), `Masked email should start with ${prefix}`);
    }
    console.log("✅ Email masking protects user privacy in all formats.\n");

    // -------------------------------------------------------------
    // Scenario 18: Password complexity validation (< 8 chars rejected)
    // -------------------------------------------------------------
    console.log("Scenario 18: Password complexity validation (< 8 chars rejected)");
    const validOtpDoc18 = await OTP.create({
      user: localUser._id,
      email: localUser.email,
      otp: "hashed",
      type: "CHANGE_PASSWORD",
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      verified: true,
    });
    const freshToken18 = jwt.sign(
      { userId: localUser._id.toString(), email: localUser.email, purpose: "PASSWORD_CHANGE", otpId: validOtpDoc18._id.toString() },
      JWT_SECRET,
      { expiresIn: "10m" }
    );

    const res18 = await invoke(changeUserPassword, {
      user: { _id: localUser._id, email: localUser.email },
      body: {
        newPassword: "short",
        confirmPassword: "short",
        resetToken: freshToken18,
      },
      ip: "127.0.0.1",
      headers: {},
    });
    assert.strictEqual(res18.statusCode, 400, "Short password (< 8 chars) must be rejected");
    console.log("✅ Passwords under 8 characters rejected.\n");

    console.log("🎉 ALL 18 PASSWORD CHANGE & GOOGLE AUTH TESTS PASSED SUCCESSFULLY!\n");
  } finally {
    User.findById = originalUserFindById;
    User.findOne = originalUserFindOne;
    OTP.findOne = originalOTPFindOne;
    OTP.findById = originalOTPFindById;
    OTP.findByIdAndUpdate = originalOTPFindByIdAndUpdate;
    OTP.create = originalOTPCreate;
    OTP.deleteMany = originalOTPDeleteMany;
    Session.updateMany = originalSessionUpdateMany;
  }
}

runTests().catch((err) => {
  console.error("❌ Test suite failed:", err);
  process.exit(1);
});
