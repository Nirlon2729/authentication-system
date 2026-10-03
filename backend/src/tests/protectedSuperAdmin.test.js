const assert = require("assert");
const {
  isProtectedSuperAdmin,
  canBlockUser,
  canDeleteUser,
  canChangeRole,
  PROTECTED_SUPER_ADMIN_EMAIL,
  ROLES,
} = require("../utils/authHelpers");
const securityGatewayService = require("../services/securityGatewayService");

async function runProtectedSuperAdminTests() {
  console.log("🧪 Running Test: Protected Super Admin Immunity...");

  // Test 1: Case-insensitivity and trimming
  assert.strictEqual(isProtectedSuperAdmin("nirlonmacwan27@gmail.com"), true);
  assert.strictEqual(isProtectedSuperAdmin("NIRLONMACWAN27@GMAIL.COM"), true);
  assert.strictEqual(isProtectedSuperAdmin("  nirlonmacwan27@gmail.com  "), true);
  assert.strictEqual(isProtectedSuperAdmin("other@example.com"), false);
  console.log("✅ Case-insensitive matching verified for root Super Admin email.");

  const superAdminTarget = {
    _id: "protected-root-sa-id",
    email: PROTECTED_SUPER_ADMIN_EMAIL,
    role: ROLES.SUPER_ADMIN,
  };

  const maliciousAdmin = {
    _id: "other-admin-id",
    email: "attacker_admin@example.com",
    role: ROLES.ADMIN,
  };

  const anotherSuperAdmin = {
    _id: "second-sa-id",
    email: "second_sa@example.com",
    role: ROLES.SUPER_ADMIN,
  };

  // Test 2: Immunity from role demotion by anyone
  assert.strictEqual(canChangeRole(maliciousAdmin, superAdminTarget, ROLES.USER).allowed, false);
  assert.strictEqual(canChangeRole(maliciousAdmin, superAdminTarget, ROLES.ADMIN).allowed, false);
  assert.strictEqual(canChangeRole(anotherSuperAdmin, superAdminTarget, ROLES.ADMIN).allowed, false);
  console.log("✅ Protected Super Admin immune from all role changes.");

  // Test 3: Immunity from blocking
  assert.strictEqual(canBlockUser(maliciousAdmin, superAdminTarget).allowed, false);
  assert.strictEqual(canBlockUser(anotherSuperAdmin, superAdminTarget).allowed, false);
  console.log("✅ Protected Super Admin immune from administrative blocking.");

  // Test 4: Immunity from deletion
  assert.strictEqual(canDeleteUser(maliciousAdmin, superAdminTarget).allowed, false);
  assert.strictEqual(canDeleteUser(anotherSuperAdmin, superAdminTarget).allowed, false);
  console.log("✅ Protected Super Admin immune from account deletion.");

  // Test 5: Security gateway immunity from programmatic account blocking
  const blockResult = await securityGatewayService.blockUserAccount(
    superAdminTarget._id,
    "TEST_SUPER_ADMIN_BLOCK",
    600,
    PROTECTED_SUPER_ADMIN_EMAIL
  );
  assert.strictEqual(blockResult.blocked, false, "Gateway must never block root Super Admin account");
  assert.strictEqual(
    securityGatewayService.isAccountBlocked(superAdminTarget._id),
    false,
    "Super Admin account must not be in blocked map"
  );
  console.log("✅ Security gateway account-level blocking excluded Super Admin successfully.");

  // Test 6: Security gateway failed login counter immunity
  const failCount = securityGatewayService.recordFailedLogin(PROTECTED_SUPER_ADMIN_EMAIL);
  assert.strictEqual(failCount, 0, "Failed login counter for root Super Admin must always remain 0");
  const failOtpCount = securityGatewayService.recordFailedOTP(PROTECTED_SUPER_ADMIN_EMAIL);
  assert.strictEqual(failOtpCount, 0, "Failed OTP counter for root Super Admin must always remain 0");
  console.log("✅ Security gateway heuristic counters remain zero for root Super Admin.");

  console.log("🎉 Test passed: Protected Super Admin Immunity\n");
}

runProtectedSuperAdminTests().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
