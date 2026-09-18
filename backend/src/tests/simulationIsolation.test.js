require("dotenv").config();
const assert = require("assert");
const crypto = require("crypto");
const mongoose = require("mongoose");
const securityGatewayService = require("../services/securityGatewayService");
const securityMonitoringService = require("../services/securityMonitoringService");
const securityGatewayMiddleware = require("../middleware/securityGatewayMiddleware");
const SecurityEvent = require("../models/SecurityEvent");

async function runSimulationIsolationTests() {
  console.log("🛡️ Starting AI Security Gateway Simulation Isolation Tests...\n");

  const adminId = "mock-admin-objectid-12345";
  const realIp = "192.168.1.100";
  const realUserAgent =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
  const realClientId = securityGatewayService.getClientIdentifier(realIp, realUserAgent);
  const realEmail = "admin@example.com";

  // -------------------------------------------------------------------------
  // Test 1: Start Simulation & Verify Isolated Synthetic Identity
  // -------------------------------------------------------------------------
  console.log("Test 1: Start Simulation & Verify Isolated Synthetic Identity");
  const sim = securityGatewayService.createSimulation({
    adminId,
    testType: "BOT_BURST",
    requestCount: 25,
    intervalMs: 100,
  });

  assert(sim.simulationId.startsWith("security-test-"), "simulationId must have security-test- prefix");
  assert(sim.testClientId.startsWith("SIMULATED_ATTACK_"), "testClientId must have SIMULATED_ATTACK_ prefix");
  assert(sim.syntheticIp.startsWith("10.255."), "syntheticIp must be an isolated 10.255.x.x private test IP");
  assert(sim.testEmail.endsWith("@example.invalid"), "testEmail must end with @example.invalid");
  assert(sim.simulationToken, "simulationToken must be generated");
  assert(sim.testClientId !== realClientId, "Synthetic test client ID must NEVER match real client ID!");

  // Verify cryptographic token validation
  const verifiedSim = securityGatewayService.verifySimulationToken(sim.simulationId, sim.simulationToken);
  assert(verifiedSim !== null, "Simulation token verification failed");
  assert.strictEqual(verifiedSim.simulationId, sim.simulationId);

  // Invalid token must be rejected
  const fakeTokenCheck = securityGatewayService.verifySimulationToken(sim.simulationId, "invalid-token-tampered");
  assert.strictEqual(fakeTokenCheck, null, "Tampered simulation token should be rejected");

  console.log("✅ Simulation start and cryptographic token authorization passed.\n");

  // -------------------------------------------------------------------------
  // Test 2: Execute Synthetic Bot Burst & Verify Block on Synthetic Client ONLY
  // -------------------------------------------------------------------------
  console.log("Test 2: Execute Synthetic Bot Burst & Verify Block on Synthetic Client ONLY");

  // Simulate a rapid bot burst from synthetic identity
  for (let i = 0; i < 35; i++) {
    securityGatewayService.recordRequest({
      clientIdentifier: sim.testClientId,
      ipAddress: sim.syntheticIp,
      userAgent: sim.syntheticUserAgent,
      path: "/api/security/test-traffic",
      method: "POST",
      payloadBytes: 1200,
      status: 200,
      account: sim.testEmail,
      requestId: `sim-req-${i}`,
      decision: "NORMAL",
      clientType: "SIMULATION",
      isSimulation: true,
      simulationId: sim.simulationId,
    });
  }

  // Evaluate the synthetic traffic
  const evalResult = await securityGatewayService.evaluateRequest({
    ipAddress: sim.syntheticIp,
    userAgent: sim.syntheticUserAgent,
    path: "/api/security/test-traffic",
    httpMethod: "POST",
    payloadBytes: 1200,
    account: sim.testEmail,
    requestId: "sim-eval-req",
    clientType: "SIMULATION",
    isSimulation: true,
    simulationId: sim.simulationId,
    testClientId: sim.testClientId,
  });

  assert(
    evalResult.action === "BLOCKED" || evalResult.decision === "CRITICAL" || evalResult.decision === "HIGH_RISK",
    `Expected synthetic bot burst to be BLOCKED, got decision=${evalResult.decision}, action=${evalResult.action}`
  );
  assert(evalResult.riskScore >= 60, `Expected risk score >= 60, got ${evalResult.riskScore}`);
  assert.strictEqual(evalResult.clientIdentifier, sim.testClientId);

  // Verify the synthetic client is now blocked in the blocklist
  const simBlockCheck = securityGatewayService.isClientBlocked(sim.testClientId, "SIMULATION");
  assert.strictEqual(simBlockCheck.isBlocked, true, "Synthetic client should be marked as blocked");
  assert.strictEqual(simBlockCheck.clientType, "SIMULATION");

  console.log("✅ Synthetic client correctly evaluated to high risk and blocked.\n");

  // -------------------------------------------------------------------------
  // Test 3: CRITICAL SAFETY CHECK - Real Client MUST NOT Be Blocked
  // -------------------------------------------------------------------------
  console.log("Test 3: CRITICAL SAFETY CHECK - Real Client MUST NOT Be Blocked");

  // Check real client status directly on blocklist
  const realBlockCheck = securityGatewayService.isClientBlocked(realClientId, "REAL");
  assert.strictEqual(
    realBlockCheck.isBlocked,
    false,
    "CRITICAL FAILURE: Real client identifier was blocked by a simulation!"
  );

  // Evaluate real client request through security engine
  const realEval = await securityGatewayService.evaluateRequest({
    ipAddress: realIp,
    userAgent: realUserAgent,
    path: "/api/dashboard",
    httpMethod: "GET",
    payloadBytes: 0,
    account: realEmail,
    requestId: "real-user-req-1",
    clientType: "REAL",
    isSimulation: false,
  });

  assert.strictEqual(realEval.action, "ALLOWED", "Real client request was not allowed");
  assert.strictEqual(realEval.decision, "NORMAL", "Real client received abnormal decision");
  assert.strictEqual(realEval.clientIdentifier, realClientId);

  console.log("✅ CRITICAL CHECK PASSED: Real client identifier is completely unblocked and allowed.\n");

  // -------------------------------------------------------------------------
  // Test 4: Middleware Integration - Concurrent Real Request vs Simulation Request
  // -------------------------------------------------------------------------
  console.log("Test 4: Middleware Integration - Concurrent Real Request vs Simulation Request");

  // 4a. Real user request entering middleware
  let realReqBlocked = false;
  let realNextCalled = false;
  const mockRealReq = {
    headers: {
      "user-agent": realUserAgent,
      "x-forwarded-for": realIp,
    },
    body: { email: realEmail },
    url: "/api/profile",
    method: "GET",
  };
  const mockRealRes = {
    setHeader: () => {},
    on: () => {},
    status: (s) => {
      if (s === 403) realReqBlocked = true;
      return { json: () => {} };
    },
  };

  await securityGatewayMiddleware(mockRealReq, mockRealRes, () => {
    realNextCalled = true;
  });

  assert.strictEqual(realNextCalled, true, "Real request was not passed to next()");
  assert.strictEqual(realReqBlocked, false, "Real request was incorrectly blocked by middleware");

  // 4b. Simulation request entering middleware with simulation headers (already blocked)
  let simReqBlocked = false;
  let simNextCalled = false;
  const mockSimReq = {
    headers: {
      "user-agent": realUserAgent, // Even if sent from admin's browser UA!
      "x-forwarded-for": realIp,   // Even if sent from admin's browser IP!
      "x-simulation-id": sim.simulationId,
      "x-simulation-token": sim.simulationToken,
    },
    body: { email: sim.testEmail },
    url: "/api/security/test-traffic",
    method: "POST",
  };
  const mockSimRes = {
    setHeader: () => {},
    on: () => {},
    status: (s) => {
      if (s === 403) simReqBlocked = true;
      return { json: () => {} };
    },
  };

  await securityGatewayMiddleware(mockSimReq, mockSimRes, () => {
    simNextCalled = true;
  });

  assert.strictEqual(simReqBlocked, true, "Blocked synthetic simulation request was not returned 403");
  assert.strictEqual(simNextCalled, false, "Blocked synthetic simulation request should not call next()");

  console.log("✅ Middleware correctly distinguishes real vs simulation requests.\n");

  // -------------------------------------------------------------------------
  // Test 5: Failed Login Simulation Does NOT Affect Real Account
  // -------------------------------------------------------------------------
  console.log("Test 5: Failed Login Simulation Does NOT Affect Real Account");

  // Record 10 simulated failed logins on the test email
  for (let i = 0; i < 10; i++) {
    securityGatewayService.recordFailedLogin(sim.testEmail);
  }

  const testEmailFails = (securityGatewayService.failedLoginsByAccount.get(sim.testEmail.toLowerCase()) || []).length;
  const realEmailFails = (securityGatewayService.failedLoginsByAccount.get(realEmail.toLowerCase()) || []).length;

  assert.strictEqual(testEmailFails, 10, "Test email failed login count mismatch");
  assert.strictEqual(realEmailFails, 0, "CRITICAL: Failed login simulation increased real email's failed login count!");

  console.log("✅ Failed login simulation isolated strictly to test email.\n");

  // -------------------------------------------------------------------------
  // Test 6: Simulation Email Notifications Are Strictly Suppressed
  // -------------------------------------------------------------------------
  console.log("Test 6: Simulation Email Notifications Are Strictly Suppressed");

  const alertResult = await securityGatewayService.sendSecurityAlertEmailIfNeeded({
    userEmail: sim.testEmail,
    eventTitle: "Simulation Attack Detected",
    description: "Synthetic test traffic triggered simulated alert",
    isSimulation: true,
  });

  assert.strictEqual(alertResult.sent, false, "Simulation alert email was sent!");
  assert.strictEqual(alertResult.suppressed, true, "Simulation alert email was not marked as suppressed");
  assert.strictEqual(alertResult.reason, "Simulation email suppressed");

  console.log("✅ Simulation email notifications successfully suppressed.\n");

  // -------------------------------------------------------------------------
  // Test 7: Stop Simulation & Clean Temporary State
  // -------------------------------------------------------------------------
  console.log("Test 7: Stop Simulation & Clean Temporary State");

  const stopResult = securityGatewayService.stopSimulation(sim.simulationId);
  assert.strictEqual(stopResult, true, "stopSimulation should return true");

  // Temporary blocked client entry for testClientId should be cleared
  const postStopCheck = securityGatewayService.isClientBlocked(sim.testClientId, "SIMULATION");
  assert.strictEqual(postStopCheck.isBlocked, false, "Simulation block was not cleared on stop");

  // Real client continues to be allowed
  const realPostStop = securityGatewayService.isClientBlocked(realClientId, "REAL");
  assert.strictEqual(realPostStop.isBlocked, false, "Real client should remain allowed after stop");

  console.log("✅ Stop simulation cleaned temporary test state.\n");

  // -------------------------------------------------------------------------
  // Test 8: Telemetry Separation (Real vs Simulation Events)
  // -------------------------------------------------------------------------
  console.log("Test 8: Telemetry Separation (Real vs Simulation Events)");

  await securityGatewayService.logSecurityEvent({
    eventType: "SIMULATION_REQUEST",
    severity: "HIGH",
    clientIdentifier: sim.testClientId,
    ipAddress: sim.syntheticIp,
    userAgent: sim.syntheticUserAgent,
    endpoint: "/api/security/test-traffic",
    httpMethod: "POST",
    httpStatus: 403,
    userEmail: sim.testEmail,
    actionTaken: "BLOCKED",
    reason: "Synthetic test block",
    riskScore: 85,
    gatewayDecision: "CRITICAL",
    isSimulation: true,
    simulationId: sim.simulationId,
    clientType: "SIMULATION",
  });

  await securityGatewayService.logSecurityEvent({
    eventType: "SUCCESSFUL_LOGIN",
    severity: "LOW",
    clientIdentifier: realClientId,
    ipAddress: realIp,
    userAgent: realUserAgent,
    endpoint: "/api/auth/login",
    httpMethod: "POST",
    httpStatus: 200,
    userEmail: realEmail,
    actionTaken: "ALLOWED",
    reason: "Legitimate login",
    riskScore: 0,
    gatewayDecision: "NORMAL",
    isSimulation: false,
    clientType: "REAL",
  });

  const realFeed = securityGatewayService.getLiveEvents(50, "REAL");
  const simFeed = securityGatewayService.getLiveEvents(50, "SIMULATION");

  assert(realFeed.every((e) => !e.isSimulation), "Real feed contained simulation events");
  assert(simFeed.every((e) => e.isSimulation), "Simulation feed contained real events");

  console.log("✅ Telemetry feed separation passed.\n");

  console.log("🎉 ALL SIMULATION ISOLATION & SECURITY GUARANTEE TESTS PASSED SUCCESSFULLY!\n");
}

runSimulationIsolationTests()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error("❌ Simulation Isolation test suite failed:", err);
    process.exit(1);
  });
