const assert = require("assert");
const {
  canChangeRole,
  canBlockUser,
  canDeleteUser,
  ROLES,
  PROTECTED_SUPER_ADMIN_EMAIL,
} = require("../utils/authHelpers");

async function runAdminCannotDemoteSuperAdminTest() {
  console.log("🧪 Running Test: Admin Cannot Demote Super Admin...");

  const adminActor = {
    _id: "admin-actor-1",
    email: "admin1@test.com",
    role: ROLES.ADMIN,
  };

  const superAdminTarget = {
    _id: "super-admin-target",
    email: PROTECTED_SUPER_ADMIN_EMAIL,
    role: ROLES.SUPER_ADMIN,
  };

  // Test 1: Admin attempting to demote Super Admin to user
  const demoteToUserResult = canChangeRole(adminActor, superAdminTarget, ROLES.USER);
  assert.strictEqual(
    demoteToUserResult.allowed,
    false,
    "Admin must not be allowed to demote Super Admin to user"
  );
  console.log("✅ Admin correctly denied demoting Super Admin to user.");

  // Test 2: Admin attempting to demote Super Admin to admin
  const demoteToAdminResult = canChangeRole(adminActor, superAdminTarget, ROLES.ADMIN);
  assert.strictEqual(
    demoteToAdminResult.allowed,
    false,
    "Admin must not be allowed to demote Super Admin to admin"
  );
  console.log("✅ Admin correctly denied demoting Super Admin to admin.");

  // Test 3: Admin cannot block Super Admin
  const blockResult = canBlockUser(adminActor, superAdminTarget);
  assert.strictEqual(
    blockResult.allowed,
    false,
    "Admin must not be allowed to block Super Admin"
  );
  console.log("✅ Admin correctly denied blocking Super Admin.");

  // Test 4: Admin cannot delete Super Admin
  const deleteResult = canDeleteUser(adminActor, superAdminTarget);
  assert.strictEqual(
    deleteResult.allowed,
    false,
    "Admin must not be allowed to delete Super Admin"
  );
  console.log("✅ Admin correctly denied deleting Super Admin.");

  console.log("🎉 Test passed: Admin Cannot Demote Super Admin\n");
}

runAdminCannotDemoteSuperAdminTest().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
