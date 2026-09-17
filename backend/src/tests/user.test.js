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

  console.log("\n🎉 ALL MIDDLEWARE TESTS PASSED!");
}

runMiddlewareTests().catch((err) => {
  console.error("❌ Middleware tests failed:", err);
  process.exit(1);
});
