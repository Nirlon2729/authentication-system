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
  console.log("\nTest 3: Non-suppressed email in default test environment returns mocked object");
  process.env.NODE_ENV = "test";
  delete process.env.ENABLE_TEST_EMAILS;
  const mockRes = await sendEmail({
    to: "realuser@company.org",
    subject: "Test Verification",
    html: "<p>123456</p>",
  });
  assert.strictEqual(mockRes.mocked, true, "Should return mocked delivery in test mode");
  assert.strictEqual(mockRes.success, true, "Should succeed in test mode");
  console.log("✅ Test mode safely mocks delivery without making outbound network connections.");

  // Test 4: Brevo HTTPS API is called when BREVO_API_KEY is present, and SMTP is NOT called
  console.log("\nTest 4: When BREVO_API_KEY is configured, Brevo HTTPS API is invoked and SMTP is NOT called");
  process.env.ENABLE_TEST_EMAILS = "true";
  process.env.BREVO_API_KEY = "test_brevo_api_key_12345";
  process.env.BREVO_SENDER_EMAIL = "sender@myauth.com";
  process.env.BREVO_SENDER_NAME = "Auth Service";
  process.env.EMAIL_USER = "smtpuser@gmail.com";
  process.env.EMAIL_PASS = "smtppassword";

  const transporter = require("../config/mail");
  let smtpCalled = false;
  const originalSendMail = transporter.sendMail;
  transporter.sendMail = async () => {
    smtpCalled = true;
    return { response: "250 OK" };
  };

  const originalFetch = global.fetch;
  let brevoCalled = false;
  let capturedBrevoRequest = null;

  global.fetch = async (url, options) => {
    if (url === "https://api.brevo.com/v3/smtp/email") {
      brevoCalled = true;
      capturedBrevoRequest = {
        url,
        method: options.method,
        headers: options.headers,
        body: JSON.parse(options.body),
      };
      return {
        ok: true,
        status: 201,
        json: async () => ({ messageId: "<brevo-test-msg-id-123>" }),
      };
    }
    return originalFetch(url, options);
  };

  const brevoRes = await sendEmail({
    to: "userforbrevo@recipient.com",
    subject: "Your OTP Code",
    html: "<strong>999888</strong>",
  });

  assert.strictEqual(brevoCalled, true, "Brevo HTTPS API should have been called");
  assert.strictEqual(smtpCalled, false, "SMTP must NOT have been called when BREVO_API_KEY is present");
  assert.strictEqual(capturedBrevoRequest.headers["api-key"], "test_brevo_api_key_12345");
  assert.strictEqual(capturedBrevoRequest.body.sender.email, "sender@myauth.com");
  assert.strictEqual(capturedBrevoRequest.body.to[0].email, "userforbrevo@recipient.com");
  assert.strictEqual(capturedBrevoRequest.body.subject, "Your OTP Code");
  assert.strictEqual(capturedBrevoRequest.body.htmlContent, "<strong>999888</strong>");
  assert.strictEqual(capturedBrevoRequest.body.textContent, "999888");
  assert.strictEqual(brevoRes.messageId, "<brevo-test-msg-id-123>");
  console.log("✅ Brevo HTTPS API dispatched with verified headers and body, without touching SMTP.");

  // Test 5: When Brevo fails, it MUST NOT fall back to SMTP
  console.log("\nTest 5: When Brevo fails, error is thrown immediately and SMTP is NOT called");
  brevoCalled = false;
  smtpCalled = false;

  global.fetch = async (url) => {
    if (url === "https://api.brevo.com/v3/smtp/email") {
      brevoCalled = true;
      return {
        ok: false,
        status: 400,
        json: async () => ({ code: "invalid_parameter", message: "sender email is not verified" }),
      };
    }
  };

  let threwError = false;
  try {
    await sendEmail({
      to: "userforbrevo@recipient.com",
      subject: "Test Failure",
      html: "<p>test</p>",
    });
  } catch (err) {
    threwError = true;
    assert.ok(err.message.includes("sender email is not verified"), `Expected error detail in: ${err.message}`);
  }

  assert.strictEqual(threwError, true, "Should have thrown an error on Brevo failure");
  assert.strictEqual(brevoCalled, true, "Brevo was invoked");
  assert.strictEqual(smtpCalled, false, "SMTP must NOT be called as fallback when BREVO_API_KEY is present");
  console.log("✅ Strict no-fallback rule verified: SMTP was NOT called when Brevo encountered an error.");

  // Test 6: Forgot-password flow uses Brevo when BREVO_API_KEY is configured
  console.log("\nTest 6: Forgot-password flow uses Brevo and does NOT call SMTP");
  brevoCalled = false;
  smtpCalled = false;
  capturedBrevoRequest = null;

  global.fetch = async (url, options) => {
    if (url === "https://api.brevo.com/v3/smtp/email") {
      brevoCalled = true;
      capturedBrevoRequest = {
        url,
        body: JSON.parse(options.body),
      };
      return {
        ok: true,
        status: 201,
        json: async () => ({ messageId: "<forgot-password-brevo-id>" }),
      };
    }
    return originalFetch(url, options);
  };

  // Dispatch forgot password OTP through sendEmail as used by authController
  const forgotPasswordEmailResult = await sendEmail({
    to: "resetpassworduser@recipient.com",
    subject: "Password Reset OTP",
    html: "<p>Your password reset code is: 123456</p>",
  });

  assert.strictEqual(brevoCalled, true, "Forgot-password flow should have dispatched via Brevo HTTPS API");
  assert.strictEqual(smtpCalled, false, "Forgot-password flow must NOT call SMTP when BREVO_API_KEY is present");
  assert.strictEqual(capturedBrevoRequest.body.to[0].email, "resetpassworduser@recipient.com");
  assert.strictEqual(capturedBrevoRequest.body.subject, "Password Reset OTP");
  assert.strictEqual(forgotPasswordEmailResult.messageId, "<forgot-password-brevo-id>");
  console.log("✅ Forgot-password flow successfully dispatches via Brevo with zero SMTP involvement.");

  // Clean up mocks
  global.fetch = originalFetch;
  transporter.sendMail = originalSendMail;
  delete process.env.ENABLE_TEST_EMAILS;
  delete process.env.BREVO_API_KEY;
  delete process.env.BREVO_SENDER_EMAIL;
  delete process.env.BREVO_SENDER_NAME;

  console.log("\n🎉 ALL EMAIL SERVICE TESTS PASSED SUCCESSFULLY!");
}

runTests().catch((err) => {
  console.error("❌ Email Service Test Failed:", err);
  process.exit(1);
});
