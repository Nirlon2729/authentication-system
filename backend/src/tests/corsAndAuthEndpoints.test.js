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
