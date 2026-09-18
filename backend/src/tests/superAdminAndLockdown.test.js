const assert = require("assert");
const http = require("http");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const app = require("../app");
const User = require("../models/User");
const lockdownService = require("../services/lockdownService");
const securityGatewayService = require("../services/securityGatewayService");
const { ROLES, LOCKDOWN_MODES, CLIENT_TYPES } = require("../constants/securityEvents");

// Helper to make HTTP requests against the test server
function makeRequest(server, options, body = null) {
  return new Promise((resolve, reject) => {
    const port = server.address().port;
    const reqOptions = {
      hostname: "127.0.0.1",
      port,
      path: options.path,
      method: options.method || "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36",
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...options.headers,
      },
    };

    const req = http.request(reqOptions, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        let json = null;
        try {
          json = JSON.parse(data);
        } catch (e) {
          json = data;
        }
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: json,
        });
      });
    });

    req.on("error", reject);

    if (body) {
      req.write(typeof body === "string" ? body : JSON.stringify(body));
    }
    req.end();
  });
}

async function runSuperAdminAndLockdownTests() {
  console.log("👑 Starting Super Admin, Global Website Lockdown & Account Blocking Tests...\n");

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));

  const JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-key-min-32-chars-ok";

  // Synthetic Test Users in Memory
  const superAdminUser = {
    _id: new mongoose.Types.ObjectId(),
    fullName: "Super Admin Officer",
    email: "superadmin_test@example.com",
    role: ROLES.SUPER_ADMIN,
    isBlocked: false,
  };

  const normalAdminUser = {
    _id: new mongoose.Types.ObjectId(),
    fullName: "Standard Admin",
    email: "admin_test@example.com",
    role: ROLES.ADMIN,
    isBlocked: false,
  };

  const normalUser = {
    _id: new mongoose.Types.ObjectId(),
    fullName: "Normal Customer",
    email: "normaluser_test@example.com",
    role: ROLES.USER,
    isBlocked: false,
  };

  const innocentUserOnSameIp = {
    _id: new mongoose.Types.ObjectId(),
    fullName: "Innocent Coworker",
    email: "coworker_test@example.com",
    role: ROLES.USER,
    isBlocked: false,
  };

  // Generate tokens
  const superAdminToken = jwt.sign(
    { id: superAdminUser._id.toString(), role: superAdminUser.role },
    JWT_SECRET,
    { expiresIn: "1h" }
  );

  const adminToken = jwt.sign(
    { id: normalAdminUser._id.toString(), role: normalAdminUser.role },
    JWT_SECRET,
    { expiresIn: "1h" }
  );

  const normalUserToken = jwt.sign(
    { id: normalUser._id.toString(), role: normalUser.role },
    JWT_SECRET,
    { expiresIn: "1h" }
  );

  const originalFindById = User.findById;
  const originalFindOne = User.findOne;

  const mockUsers = new Map([
    [superAdminUser._id.toString(), superAdminUser],
    [normalAdminUser._id.toString(), normalAdminUser],
    [normalUser._id.toString(), normalUser],
    [innocentUserOnSameIp._id.toString(), innocentUserOnSameIp],
  ]);

  const mockUsersByEmail = new Map([
    [superAdminUser.email, superAdminUser],
    [normalAdminUser.email, normalAdminUser],
    [normalUser.email, normalUser],
    [innocentUserOnSameIp.email, innocentUserOnSameIp],
  ]);

  function createMockQuery(user) {
    const p = Promise.resolve(user);
    p.select = () => p;
    return p;
  }

  User.findById = function (id) {
    const u = mockUsers.get(id?.toString());
    if (u) return createMockQuery(u);
    return originalFindById.apply(this, arguments);
  };

  User.findOne = function (query) {
    const email = query?.email?.toLowerCase?.()?.trim?.() || query?.email;
    if (email && mockUsersByEmail.has(email)) {
      return createMockQuery(mockUsersByEmail.get(email));
    }
    return originalFindOne.apply(this, arguments);
  };

  try {
    // -------------------------------------------------------------------------
    // Test 1: Role Hierarchy & Super Admin Authorization
    // -------------------------------------------------------------------------
    console.log("Test 1: Role Hierarchy & Super Admin Route Protection");

    // Normal User tries to access Super Admin endpoint
    const res1 = await makeRequest(server, {
      path: "/api/security/super-admin/website-status",
      method: "GET",
      headers: { Authorization: `Bearer ${normalUserToken}` },
    });
    assert.strictEqual(res1.statusCode, 403, "Normal user should be rejected from Super Admin route");
    assert.strictEqual(res1.data.success, false);

    // Standard Admin tries to access Super Admin endpoint
    const res2 = await makeRequest(server, {
      path: "/api/security/super-admin/website-status",
      method: "GET",
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(res2.statusCode, 403, "Standard Admin must NOT access Super Admin endpoint");
    assert.strictEqual(res2.data.success, false);

    // Super Admin accesses Super Admin endpoint
    const res3 = await makeRequest(server, {
      path: "/api/security/super-admin/website-status",
      method: "GET",
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    assert.strictEqual(res3.statusCode, 200, "Super Admin must have access to emergency controls");
    assert.strictEqual(res3.data.status.mode, LOCKDOWN_MODES.ONLINE);

    console.log("✅ Super Admin role authorization and strict rejection passed.\n");

    // -------------------------------------------------------------------------
    // Test 2: Activate Global Website Lockdown
    // -------------------------------------------------------------------------
    console.log("Test 2: Activate Server-Side Global Website Lockdown");

    const lockdownRes = await makeRequest(
      server,
      {
        path: "/api/security/super-admin/website/lockdown",
        method: "POST",
        headers: { Authorization: `Bearer ${superAdminToken}` },
      },
      { reason: "Emergency cyber anomaly investigation" }
    );

    assert.strictEqual(lockdownRes.statusCode, 200, "Lockdown activation failed");
    assert.strictEqual(lockdownRes.data.status.mode, LOCKDOWN_MODES.LOCKDOWN);
    assert.strictEqual(lockdownService.isLockdownActive(), true, "Lockdown service must be active");

    console.log("✅ Global website lockdown successfully activated.\n");

    // -------------------------------------------------------------------------
    // Test 3: Normal User Operations Blocked During Lockdown (HTTP 503)
    // -------------------------------------------------------------------------
    console.log("Test 3: Normal Authentication Endpoints Return HTTP 503 During Lockdown");

    // Normal User Login during lockdown
    const loginRes = await makeRequest(
      server,
      { path: "/api/auth/login", method: "POST" },
      { email: "normaluser_test@example.com", password: "Password123!" }
    );
    assert.strictEqual(loginRes.statusCode, 503, "Normal user login must return 503 during lockdown");
    assert.strictEqual(loginRes.data.code, "SERVICE_UNAVAILABLE");
    assert(
      loginRes.data.message.includes("temporarily unavailable"),
      "Message must state website is temporarily unavailable"
    );

    // Normal User Signup during lockdown
    const signupRes = await makeRequest(
      server,
      { path: "/api/auth/signup", method: "POST" },
      { fullName: "New Hacker", email: "hacker@example.com", password: "Password123!" }
    );
    assert.strictEqual(signupRes.statusCode, 503, "Signup must return 503 during lockdown");

    // Forgot Password during lockdown
    const forgotRes = await makeRequest(
      server,
      { path: "/api/auth/forgot-password", method: "POST" },
      { email: "normaluser_test@example.com" }
    );
    assert.strictEqual(forgotRes.statusCode, 503, "Password reset request must return 503 during lockdown");

    console.log("✅ Authentication endpoints safely return 503 during lockdown.\n");

    // -------------------------------------------------------------------------
    // Test 4: Super Admin Emergency Access & Website Restoration
    // -------------------------------------------------------------------------
    console.log("Test 4: Super Admin Retains Emergency Access and Restores Website");

    // Super Admin checks status during lockdown
    const statusCheck = await makeRequest(server, {
      path: "/api/security/super-admin/website-status",
      method: "GET",
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    assert.strictEqual(statusCheck.statusCode, 200, "Super Admin must access controls during lockdown");
    assert.strictEqual(statusCheck.data.status.mode, LOCKDOWN_MODES.LOCKDOWN);

    // Super Admin restores website
    const restoreRes = await makeRequest(
      server,
      {
        path: "/api/security/super-admin/website/restore",
        method: "POST",
        headers: { Authorization: `Bearer ${superAdminToken}` },
      },
      {}
    );
    assert.strictEqual(restoreRes.statusCode, 200, "Website restore must succeed");
    assert.strictEqual(restoreRes.data.status.mode, LOCKDOWN_MODES.ONLINE);
    assert.strictEqual(lockdownService.isLockdownActive(), false, "Lockdown service must be deactivated");

    console.log("✅ Super Admin successfully restored website to ONLINE mode.\n");

    // -------------------------------------------------------------------------
    // Test 5: Account-Level Temporary User Blocking (Isolated to req.user._id)
    // -------------------------------------------------------------------------
    console.log("Test 5: Account-Level User Restriction (req.user._id ONLY)");

    const targetUser = {
      _id: new mongoose.Types.ObjectId(),
      fullName: "Attacking Authenticated User",
      email: "attacker_account@example.com",
      role: ROLES.USER,
      isBlocked: true,
      blockedUntil: new Date(Date.now() + 15 * 60 * 1000), // 15 mins in future
      blockReason: "Automated brute-force behavior detected",
      save: async () => {},
    };

    // Evaluate checkUserBlocked on the restricted user
    const blockCheck = await securityGatewayService.checkUserBlocked(targetUser);
    assert.strictEqual(blockCheck.isBlocked, true, "Target user should be blocked");
    assert.strictEqual(blockCheck.code, "USER_TEMPORARILY_BLOCKED");
    assert(blockCheck.remainingSeconds > 800, "remainingSeconds should reflect duration");

    // Evaluate checkUserBlocked on the innocent coworker sharing the same IP
    const innocentCheck = await securityGatewayService.checkUserBlocked(innocentUserOnSameIp);
    assert.strictEqual(innocentCheck.isBlocked, false, "Innocent coworker must NOT be blocked");

    console.log("✅ Account-level blocking isolates strictly to attacking user._id.\n");

    // -------------------------------------------------------------------------
    // Test 6: Lazy Expiration of Temporary User Blocks
    // -------------------------------------------------------------------------
    console.log("Test 6: Automatic Lazy Expiration of Expired User Blocks");

    const expiredBlockedUser = {
      _id: new mongoose.Types.ObjectId(),
      fullName: "Expired Blocked User",
      email: "expired_block@example.com",
      role: ROLES.USER,
      isBlocked: true,
      blockedUntil: new Date(Date.now() - 5000), // 5 seconds in the past
      save: async function () {
        this.saved = true;
      },
    };

    const lazyCheck = await securityGatewayService.checkUserBlocked(expiredBlockedUser);
    assert.strictEqual(lazyCheck.isBlocked, false, "Expired block must lazily unblock user");
    assert.strictEqual(expiredBlockedUser.isBlocked, false, "User model flag must be cleared");

    console.log("✅ Lazy expiration cleanly clears expired user restrictions.\n");

    // -------------------------------------------------------------------------
    // Test 7: Simulation Attacks Continue to Isolate to Synthetic Identities
    // -------------------------------------------------------------------------
    console.log("Test 7: Simulation Attacks Do NOT Block Real Users or Lock Down Website");

    const sim = securityGatewayService.createSimulation({
      testType: "BOT_BURST",
      requestsCount: 20,
    });

    const simEvaluation = await securityGatewayService.evaluateRequest({
      ipAddress: sim.syntheticIp,
      userAgent: sim.syntheticUserAgent,
      path: "/api/auth/login",
      httpMethod: "POST",
      payloadBytes: 128,
      account: sim.testEmail,
      requestId: "sim-test-lockdown-check",
      clientType: CLIENT_TYPES.SIMULATION,
      isSimulation: true,
      simulationId: sim.simulationId,
      testClientId: sim.testClientId,
    });

    assert.strictEqual(simEvaluation.clientType, CLIENT_TYPES.SIMULATION);
    assert.strictEqual(lockdownService.isLockdownActive(), false, "Simulation must NEVER trigger global lockdown");
    assert.strictEqual(superAdminUser.isBlocked, false, "Super admin must NEVER be blocked by simulation");

    securityGatewayService.stopSimulation(sim.simulationId);

    console.log("✅ Simulation isolation intact: Zero effect on real users, admin, or lockdown state.\n");

    console.log("🎉 ALL SUPER ADMIN, LOCKDOWN & USER BLOCKING TESTS PASSED SUCCESSFULLY!");
  } finally {
    User.findById = originalFindById;
    User.findOne = originalFindOne;
    server.close();
  }
}

runSuperAdminAndLockdownTests().catch((err) => {
  console.error("❌ Super Admin & Lockdown test failed:", err);
  process.exit(1);
});
