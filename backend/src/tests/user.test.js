const assert = require("assert");
const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(__dirname, "../../.env") });
dotenv.config();

const jwt = require("jsonwebtoken");
const authMiddleware = require("../middleware/authMiddleware");

async function runMiddlewareTests() {
  console.log("🧪 Starting Middleware Unit Tests...\n");

  // 1. Missing Token Test
  let status1 = null;
  let json1 = null;
  const req1 = { headers: {}, cookies: {} };
  const res1 = {
    status: (s) => {
      status1 = s;
      return {
        json: (j) => {
          json1 = j;
        },
      };
    },
  };
  await authMiddleware(req1, res1, () => {});
  assert.strictEqual(status1, 401, "Missing token should return 401");
  assert.strictEqual(json1.success, false);
  console.log("✅ Missing token test passed.");

  // 2. Invalid Token Test
  let status2 = null;
  let json2 = null;
  const req2 = { headers: { authorization: "Bearer invalid.token.value" }, cookies: {} };
  const res2 = {
    status: (s) => {
      status2 = s;
      return {
        json: (j) => {
          json2 = j;
        },
      };
    },
  };
  await authMiddleware(req2, res2, () => {});
  assert.strictEqual(status2, 401, "Invalid token should return 401");
  assert.strictEqual(json2.success, false);
  console.log("✅ Invalid token test passed.");

  // 3. Expired Token Test
  let status3 = null;
  let json3 = null;
  const expiredToken = jwt.sign({ id: "mockId" }, process.env.JWT_SECRET, { expiresIn: "0s" });
  const req3 = { headers: { authorization: `Bearer ${expiredToken}` }, cookies: {} };
  const res3 = {
    status: (s) => {
      status3 = s;
      return {
        json: (j) => {
          json3 = j;
        },
      };
    },
  };
  await authMiddleware(req3, res3, () => {});
  assert.strictEqual(status3, 401, "Expired token should return 401");
  assert.strictEqual(json3.message, "Token expired. Please login again.");
  console.log("✅ Expired token test passed.");

  // Mock User.findById for successful auth verification
  const User = require("../models/User");
  const originalFindById = User.findById;
  const mockUser = {
    _id: "60d0fe4f5311236168a109ca",
    fullName: "Independent Auth Tester",
    email: "authtest@example.com",
    role: "user",
    isBlocked: false,
  };
  User.findById = function () {
    const p = Promise.resolve(mockUser);
    p.select = () => p;
    return p;
  };

  try {
    const validToken = jwt.sign(
      { id: mockUser._id.toString(), email: mockUser.email, role: mockUser.role },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    // 4. Independent Bearer-Token Path (Authorization header ONLY, cookies empty)
    let nextCalled4 = false;
    const req4 = {
      headers: { authorization: `Bearer ${validToken}` },
      cookies: {},
      signedCookies: {},
    };
    const res4 = {
      status: (s) => ({ json: () => {} }),
    };
    await authMiddleware(req4, res4, () => {
      nextCalled4 = true;
    });
    assert.strictEqual(nextCalled4, true, "Bearer-token authentication should call next()");
    assert.strictEqual(req4.user._id, mockUser._id);
    console.log("✅ Independent Bearer-token authentication path passed.");

    // 5. Independent HTTP-Only Cookie Path (cookies.token ONLY, headers empty)
    let nextCalled5 = false;
    const req5 = {
      headers: {},
      cookies: { token: validToken },
      signedCookies: {},
    };
    const res5 = {
      status: (s) => ({ json: () => {} }),
    };
    await authMiddleware(req5, res5, () => {
      nextCalled5 = true;
    });
    assert.strictEqual(nextCalled5, true, "Cookie authentication should call next()");
    assert.strictEqual(req5.user._id, mockUser._id);
    console.log("✅ Independent HTTP-only cookie authentication path passed.");

    // 6. Independent Signed Cookie Path (signedCookies.token ONLY, headers empty)
    let nextCalled6 = false;
    const req6 = {
      headers: {},
      cookies: {},
      signedCookies: { token: validToken },
    };
    const res6 = {
      status: (s) => ({ json: () => {} }),
    };
    await authMiddleware(req6, res6, () => {
      nextCalled6 = true;
    });
    assert.strictEqual(nextCalled6, true, "Signed cookie authentication should call next()");
    assert.strictEqual(req6.user._id, mockUser._id);
    console.log("✅ Independent signed cookie authentication path passed.");
  } finally {
    User.findById = originalFindById;
  }

  console.log("\n🎉 ALL MIDDLEWARE TESTS PASSED!");
}

runMiddlewareTests().catch((err) => {
  console.error("❌ Middleware tests failed:", err);
  process.exit(1);
});
