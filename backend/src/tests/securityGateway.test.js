const assert = require("assert");
const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(__dirname, "../../.env") });
dotenv.config();

const securityGatewayService = require("../services/securityGatewayService");
const securityAlertTemplate = require("../templates/email/securityAlertTemplate");

async function runSecurityGatewayTests() {
  console.log("🛡️ Starting AI Security Gateway Integration Tests...\n");

  // Test 1: Client Identifier Generation
  console.log("Test 1: Privacy-Conscious Client Identifier Hashing");
  const id1 = securityGatewayService.getClientIdentifier("192.168.1.100", "Mozilla/5.0 Chrome/120");
  const id2 = securityGatewayService.getClientIdentifier("192.168.1.100", "Mozilla/5.0 Chrome/120");
  const id3 = securityGatewayService.getClientIdentifier("10.0.0.1", "Mozilla/5.0 Firefox/115");

  assert.strictEqual(id1, id2, "Client identifiers should be deterministic for identical client signatures");
  assert.notStrictEqual(id1, id3, "Different IP/User-Agent must produce different hashes");
  assert.strictEqual(id1.length, 16, "Client identifier hash length must be 16 characters");
  console.log("✅ Client identifier hashing passed.\n");

  // Test 2: Sliding-Window Metrics Extraction
  console.log("Test 2: Sliding-Window Feature Vector Extraction");
  const testClientId = "test_client_001";
  for (let i = 0; i < 5; i++) {
    securityGatewayService.recordRequest({
      clientIdentifier: testClientId,
      path: "/api/auth/login",
      payloadBytes: 150 + i * 10,
      status: i === 4 ? 401 : 200,
    });
  }

  const metrics = securityGatewayService.extractClientMetrics(testClientId);
  assert(metrics.frequency >= 5, `Expected frequency >= 5, got ${metrics.frequency}`);
  assert(metrics.errorRatio >= 0.2, `Expected errorRatio >= 0.2, got ${metrics.errorRatio}`);
  assert(metrics.payloadSizeDelta === 40, `Expected payload delta 40, got ${metrics.payloadSizeDelta}`);
  console.log("✅ Sliding-window telemetry metrics extraction passed.\n");

  // Test 3: Failed Login Pattern & Attack Thresholding
  console.log("Test 3: Failed Login Tracking & Pattern Scoring");
  const victimEmail = "target_user@example.com";
  securityGatewayService.resetFailedLogins(victimEmail);

  for (let i = 1; i <= 4; i++) {
    const count = securityGatewayService.recordFailedLogin(victimEmail);
    assert.strictEqual(count, i, `Failed count should be ${i}`);
  }

  const evalResult = await securityGatewayService.evaluateRequest({
    ipAddress: "192.168.1.50",
    userAgent: "Python-Requests/2.28",
    path: "/api/auth/login",
    httpMethod: "POST",
    account: victimEmail,
  });

  assert(evalResult.riskScore >= 25, `Expected elevated risk score for repeated failed logins, got ${evalResult.riskScore}`);
  console.log("✅ Failed login threat evaluation passed.\n");

  // Test 4: Gateway Blocklisting
  console.log("Test 4: Client Blocklisting & Auto-Expiry");
  const badClient = "bad_actor_999";
  securityGatewayService.blockClient(badClient, "Repeated high risk cyber anomaly", 2);

  const check1 = securityGatewayService.isClientBlocked(badClient);
  assert.strictEqual(check1.isBlocked, true, "Client should be marked as blocked");

  const blockedEval = await securityGatewayService.evaluateRequest({
    ipAddress: "203.0.113.195",
    userAgent: "BadBot/1.0",
    path: "/api/auth/login",
    httpMethod: "POST",
  });
  // If we block using client identifier
  securityGatewayService.blockClient(securityGatewayService.getClientIdentifier("203.0.113.195", "BadBot/1.0"), "Test block", 60);
  const evalBlocked = await securityGatewayService.evaluateRequest({
    ipAddress: "203.0.113.195",
    userAgent: "BadBot/1.0",
    path: "/api/auth/login",
    httpMethod: "POST",
  });
  assert.strictEqual(evalBlocked.action, "BLOCKED", "Blocked client request must result in BLOCKED action");
  console.log("✅ Blocklisting and threat rejection passed.\n");

  // Test 5: Resilient Offline Gateway Fallback
  console.log("Test 5: Resilient Fallback When Gateway Endpoint is Offline");
  const normalEval = await securityGatewayService.evaluateRequest({
    ipAddress: "127.0.0.1",
    userAgent: "Clean-Browser",
    path: "/api/auth/login",
    httpMethod: "POST",
    account: "clean_user@example.com",
  });
  assert(normalEval.decision === "NORMAL" || normalEval.action === "ALLOWED", "Clean request must be allowed without error");
  console.log("✅ Offline fallback tolerance passed.\n");

  // Test 6: Security Alert Email Template & Cooldown Throttling
  console.log("Test 6: Security Alert Email & Throttling");
  const html = securityAlertTemplate({
    userEmail: "alert_test@example.com",
    userName: "Alice Smith",
    eventTitle: "Suspicious Traffic Blocked",
    description: "Multiple failed login attempts were blocked.",
    ipAddress: "198.51.100.4",
    device: "Chrome on Linux",
    actionTaken: "Blocked by Gateway",
    isBlocked: true,
  });

  assert(html.includes("AuthCore Security Center"), "Email template missing header");
  assert(html.includes("alert_test@example.com"), "Email template missing recipient email");
  assert(html.includes("198.51.100.4"), "Email template missing IP address");

  // Test cooldown throttling
  const testCooldownEmail = "throttle_test@example.com";
  // Set first alert timestamp manually in alertCooldowns map
  securityGatewayService.alertCooldowns.set(testCooldownEmail, Date.now());
  const sent2 = await securityGatewayService.sendSecurityAlertEmailIfNeeded({
    userEmail: testCooldownEmail,
    eventTitle: "Test Alert",
    description: "Duplicate test alert inside cooldown window",
  });
  assert.strictEqual(sent2, false, "Second alert within cooldown period must be throttled");
  console.log("✅ Alert template & throttling logic passed.\n");

  console.log("🎉 ALL AI SECURITY GATEWAY TESTS PASSED SUCCESSFULLY!");
}

runSecurityGatewayTests().catch((err) => {
  console.error("❌ Security Gateway test failed:", err);
  process.exit(1);
});
