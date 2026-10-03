const assert = require("assert");
const { canChangeRole, ROLES } = require("../utils/authHelpers");

async function runAdminCanDemoteAnotherAdminTest() {
  console.log("🧪 Running Test: Admin Can Demote Another Admin...");

  const adminActor = {
    _id: "admin-actor-1",
    email: "admin1@test.com",
    role: ROLES.ADMIN,
  };

  const adminTarget = {
    _id: "admin-target-2",
    email: "admin2@test.com",
    role: ROLES.ADMIN,
  };

  // Test 1: Admin A demoting Admin B to "user" is allowed
  const result = canChangeRole(adminActor, adminTarget, ROLES.USER);
  assert.strictEqual(
    result.allowed,
    true,
    "Admin should be allowed to demote another admin to user"
  );
  console.log("✅ Admin A successfully allowed to demote Admin B to user role.");

  // Test 2: Admin A cannot promote Admin B to super_admin
  const invalidResult = canChangeRole(adminActor, adminTarget, ROLES.SUPER_ADMIN);
  assert.strictEqual(
    invalidResult.allowed,
    false,
    "Regular admin must not be allowed to promote to super_admin"
  );
  console.log("✅ Regular admin correctly denied promoting another user to super_admin.");

  console.log("🎉 Test passed: Admin Can Demote Another Admin\n");
}

runAdminCanDemoteAnotherAdminTest().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
