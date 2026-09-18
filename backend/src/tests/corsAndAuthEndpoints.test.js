require("dotenv").config();
const http = require("http");
const assert = require("assert");
const mongoose = require("mongoose");
const app = require("../app");
const connectDB = require("../config/db");

async function runTests() {
  console.log("🌐 Starting CORS, Preflight, COOP, & Auth Endpoint Tests...\n");

  try {
    await connectDB();
  } catch (dbErr) {
    console.warn("Database connection warning in test:", dbErr.message);
  }

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;

  const makeRequest = (options, postData = null) => {
    return new Promise((resolve, reject) => {
      const req = http.request(options, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          let json = null;
          try {
            json = JSON.parse(data);
          } catch (_e) {
            json = data;
          }
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: json,
          });
        });
      });

      req.on("error", reject);

      if (postData) {
        req.write(typeof postData === "string" ? postData : JSON.stringify(postData));
      }
      req.end();
    });
  };

  try {
    // 1. Preflight OPTIONS on /api/auth/login
    console.log("Test 1: Preflight OPTIONS on /api/auth/login from http://localhost:5174");
    const preflightLogin = await makeRequest({
      hostname: "127.0.0.1",
      port,
      path: "/api/auth/login",
      method: "OPTIONS",
      headers: {
        Origin: "http://localhost:5174",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "Content-Type, Authorization, X-Request-ID",
      },
    });

    assert.strictEqual(
      preflightLogin.statusCode,
      204,
      `Expected status 204 on preflight, got ${preflightLogin.statusCode}`
    );
    assert.strictEqual(
      preflightLogin.headers["access-control-allow-origin"],
      "http://localhost:5174",
      "Missing or incorrect Access-Control-Allow-Origin header"
    );
    assert.strictEqual(
      preflightLogin.headers["access-control-allow-credentials"],
      "true",
      "Missing Access-Control-Allow-Credentials header"
    );
    assert.strictEqual(
      preflightLogin.headers["cross-origin-opener-policy"],
      "same-origin-allow-popups",
      "Helmet COOP policy must be same-origin-allow-popups for Google OAuth"
    );
    console.log("✅ OPTIONS /api/auth/login preflight passed.\n");

    // 2. Preflight OPTIONS on /api/auth/google
    console.log("Test 2: Preflight OPTIONS on /api/auth/google from http://localhost:5174");
    const preflightGoogle = await makeRequest({
      hostname: "127.0.0.1",
      port,
      path: "/api/auth/google",
      method: "OPTIONS",
      headers: {
        Origin: "http://localhost:5174",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "Content-Type, Authorization, X-Request-ID",
      },
    });

    assert.strictEqual(
      preflightGoogle.statusCode,
      204,
      `Expected status 204 on preflight, got ${preflightGoogle.statusCode}`
    );
    assert.strictEqual(
      preflightGoogle.headers["access-control-allow-origin"],
      "http://localhost:5174",
      "Missing or incorrect Access-Control-Allow-Origin header"
    );
    assert.strictEqual(
      preflightGoogle.headers["access-control-allow-credentials"],
      "true",
      "Missing Access-Control-Allow-Credentials header"
    );
    console.log("✅ OPTIONS /api/auth/google preflight passed.\n");

    // 3. POST /api/auth/login with Origin
    console.log("Test 3: POST /api/auth/login CORS Headers with Validation");
    const postLogin = await makeRequest(
      {
        hostname: "127.0.0.1",
        port,
        path: "/api/auth/login",
        method: "POST",
        headers: {
          Origin: "http://localhost:5174",
          "Content-Type": "application/json",
        },
      },
      { email: "nonexistent_test_account@example.com", password: "wrongpassword123" }
    );

    assert.strictEqual(
      postLogin.headers["access-control-allow-origin"],
      "http://localhost:5174",
      "Expected Access-Control-Allow-Origin on POST /api/auth/login"
    );
    assert.strictEqual(
      postLogin.headers["access-control-allow-credentials"],
      "true",
      "Expected Access-Control-Allow-Credentials on POST /api/auth/login"
    );
    console.log("✅ POST /api/auth/login returns valid response with CORS headers.\n");

    // 4. POST /api/auth/google with Mock Token
    console.log("Test 4: POST /api/auth/google CORS Headers with Token Flow");
    const postGoogle = await makeRequest(
      {
        hostname: "127.0.0.1",
        port,
        path: "/api/auth/google",
        method: "POST",
        headers: {
          Origin: "http://localhost:5174",
          "Content-Type": "application/json",
        },
      },
      { idToken: "mock-google-token-testuser@gmail.com", remember: true }
    );

    assert.strictEqual(
      postGoogle.headers["access-control-allow-origin"],
      "http://localhost:5174",
      "Expected Access-Control-Allow-Origin on POST /api/auth/google"
    );
    assert.strictEqual(
      postGoogle.headers["access-control-allow-credentials"],
      "true",
      "Expected Access-Control-Allow-Credentials on POST /api/auth/google"
    );
    assert.strictEqual(
      postGoogle.headers["cross-origin-opener-policy"],
      "same-origin-allow-popups",
      "Expected COOP header on POST response"
    );
    console.log("✅ POST /api/auth/google handles request and returns CORS headers.\n");

    // 5. Configured CLIENT_URL is allowed with credentials
    console.log("Test 5: Preflight OPTIONS from configured CLIENT_URL (https://auth-security-frontend.onrender.com)");
    const savedClientUrl = process.env.CLIENT_URL;
    process.env.CLIENT_URL = "auth-security-frontend.onrender.com"; // Test bare hostname normalization
    const preflightConfigured = await makeRequest({
      hostname: "127.0.0.1",
      port,
      path: "/api/auth/login",
      method: "OPTIONS",
      headers: {
        Origin: "https://auth-security-frontend.onrender.com",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "Content-Type, Authorization",
      },
    });

    assert.strictEqual(
      preflightConfigured.statusCode,
      204,
      `Expected status 204 on preflight from configured origin, got ${preflightConfigured.statusCode}`
    );
    assert.strictEqual(
      preflightConfigured.headers["access-control-allow-origin"],
      "https://auth-security-frontend.onrender.com",
      "Configured CLIENT_URL must receive Access-Control-Allow-Origin"
    );
    assert.strictEqual(
      preflightConfigured.headers["access-control-allow-credentials"],
      "true",
      "Configured CLIENT_URL must receive Access-Control-Allow-Credentials"
    );
    console.log("✅ Configured CLIENT_URL successfully allowed with credentials.\n");

    // 6. Arbitrary unauthorized *.onrender.com origin is strictly rejected
    console.log("Test 6: Reject arbitrary unauthorized onrender origin (https://arbitrary-attacker.onrender.com)");
    const preflightAttackerOnrender = await makeRequest({
      hostname: "127.0.0.1",
      port,
      path: "/api/auth/login",
      method: "OPTIONS",
      headers: {
        Origin: "https://arbitrary-attacker.onrender.com",
        "Access-Control-Request-Method": "POST",
      },
    });

    assert.strictEqual(
      preflightAttackerOnrender.headers["access-control-allow-origin"],
      undefined,
      "Unauthorized arbitrary onrender origin must NOT receive Access-Control-Allow-Origin"
    );
    console.log("✅ Arbitrary onrender origin correctly rejected by CORS.\n");

    // 7. Arbitrary third-party domain is strictly rejected
    console.log("Test 7: Reject arbitrary third-party origin (https://evil-attacker.com)");
    const preflightEvil = await makeRequest({
      hostname: "127.0.0.1",
      port,
      path: "/api/auth/login",
      method: "OPTIONS",
      headers: {
        Origin: "https://evil-attacker.com",
        "Access-Control-Request-Method": "POST",
      },
    });

    assert.strictEqual(
      preflightEvil.headers["access-control-allow-origin"],
      undefined,
      "Third-party unauthorized origin must NOT receive Access-Control-Allow-Origin"
    );
    console.log("✅ Arbitrary third-party origin correctly rejected by CORS.\n");
    process.env.CLIENT_URL = savedClientUrl;

    // 8. Independent Bearer-token authentication path (Authorization header ONLY)
    console.log("Test 8: Independent Bearer-token authentication on /api/profile (no cookies)");
    const jwt = require("jsonwebtoken");
    const User = require("../models/User");
    const originalFindById = User.findById;
    const mockUser = {
      _id: new mongoose.Types.ObjectId("60d0fe4f5311236168a109ca"),
      fullName: "E2E Auth Tester",
      email: "e2etester@example.com",
      role: "user",
      isBlocked: false,
      toObject: () => ({
        _id: "60d0fe4f5311236168a109ca",
        fullName: "E2E Auth Tester",
        email: "e2etester@example.com",
        role: "user",
      }),
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

      const bearerRes = await makeRequest({
        hostname: "127.0.0.1",
        port,
        path: "/api/profile",
        method: "GET",
        headers: {
          Authorization: `Bearer ${validToken}`,
        },
      });

      assert.strictEqual(
        bearerRes.statusCode,
        200,
        `Expected status 200 with Bearer token, got ${bearerRes.statusCode}`
      );
      assert.strictEqual(bearerRes.body.success, true);
      console.log("✅ Independent Bearer-token authentication path successfully returns 200.\n");

      // 9. Independent HTTP-Only Cookie authentication path (Cookie ONLY, no Authorization header)
      console.log("Test 9: Independent HTTP-only cookie authentication on /api/profile (no Authorization header)");
      const cookieRes = await makeRequest({
        hostname: "127.0.0.1",
        port,
        path: "/api/profile",
        method: "GET",
        headers: {
          Cookie: `token=${validToken}`,
        },
      });

      assert.strictEqual(
        cookieRes.statusCode,
        200,
        `Expected status 200 with Cookie token, got ${cookieRes.statusCode}`
      );
      assert.strictEqual(cookieRes.body.success, true);
      console.log("✅ Independent HTTP-only cookie authentication path successfully returns 200.\n");

      // 10. Missing both Bearer token and Cookie
      console.log("Test 10: Reject request on /api/profile when neither Bearer token nor Cookie is provided");
      const unauthRes = await makeRequest({
        hostname: "127.0.0.1",
        port,
        path: "/api/profile",
        method: "GET",
        headers: {},
      });

      assert.strictEqual(
        unauthRes.statusCode,
        401,
        `Expected status 401 with missing auth credentials, got ${unauthRes.statusCode}`
      );
      assert.strictEqual(unauthRes.body.success, false);
      console.log("✅ Missing credentials correctly rejected with 401.\n");
    } finally {
      User.findById = originalFindById;
    }

    console.log("🎉 ALL CORS & AUTH ENDPOINT TESTS PASSED SUCCESSFULLY!");
  } finally {
    server.close();
    await mongoose.disconnect().catch(() => {});
  }
}

runTests().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
