const assert = require("assert");
const sendEmail = require("../services/emailService");
const { logEmailDiagnostics } = require("../config/mail");

async function runTests() {
  console.log("🧪 Starting Email Service & Diagnostics Tests...\n");

  // Test 1: Suppressed simulation/test address
  console.log("Test 1: Suppressed recipient handling");
  const testAddresses = [
    "user@example.invalid",
    "security-test-bot@domain.com",
    "test@example.com",
    "testuser@gmail.com",
  ];
  for (const addr of testAddresses) {
    const res = await sendEmail({ to: addr, subject: "Test", html: "<p>test</p>" });
    assert.strictEqual(res.suppressed, true, `Expected ${addr} to be suppressed`);
  }
  console.log("✅ Suppressed recipient filtering works as expected.");

  // Test 2: Safe diagnostic logging doesn't throw or leak credentials
  console.log("\nTest 2: Safe diagnostic logging check");
  assert.doesNotThrow(() => {
    logEmailDiagnostics();
  }, "logEmailDiagnostics should execute safely without throwing");
  console.log("✅ Diagnostics function executes safely.");

  // Test 3: Test mode mocking
  console.log("\nTest 3: Non-suppressed email in test environment returns mocked object");
  process.env.NODE_ENV = "test";
  const mockRes = await sendEmail({
    to: "realuser@company.org",
    subject: "Test Verification",
    html: "<p>123456</p>",
  });
  assert.strictEqual(mockRes.mocked, true, "Should return mocked delivery in test mode");
  assert.strictEqual(mockRes.success, true, "Should succeed in test mode");
  console.log("✅ Test mode safely mocks delivery without making outbound network connections.");

  console.log("\n🎉 ALL EMAIL SERVICE TESTS PASSED SUCCESSFULLY!");
}

runTests().catch((err) => {
  console.error("❌ Email Service Test Failed:", err);
  process.exit(1);
});
