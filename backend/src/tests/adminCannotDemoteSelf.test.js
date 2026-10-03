const assert = require("assert");
const {
  canChangeRole,
  canBlockUser,
  canDeleteUser,
  ROLES,
} = require("../utils/authHelpers");

async function runAdminCannotDemoteSelfTest() {
  console.log("🧪 Running Test: Admin Cannot Demote Self...");

  const adminActor = {
    _id: "admin-self-1",
    email: "admin_self@test.com",
    role: ROLES.ADMIN,
  };

  // Test 1: Admin attempting to change their own role to user
  const demoteSelfResult = canChangeRole(adminActor, adminActor, ROLES.USER);
  assert.strictEqual(
    demoteSelfResult.allowed,
    false,
    "Admin must not be allowed to change their own role"
  );
  assert(
    (demoteSelfResult.reason || demoteSelfResult.message || "").toLowerCase().includes("role"),
    "Message should indicate cannot modify own role"
  );
  console.log("✅ Admin correctly denied changing their own role to user.");

  // Test 2: Admin attempting to block self
  const blockSelfResult = canBlockUser(adminActor, adminActor);
  assert.strictEqual(
    blockSelfResult.allowed,
    false,
    "Admin must not be allowed to block themselves"
  );
  console.log("✅ Admin correctly denied blocking their own account.");

  // Test 3: Admin attempting to delete self
  const deleteSelfResult = canDeleteUser(adminActor, adminActor);
  assert.strictEqual(
    deleteSelfResult.allowed,
    false,
    "Admin must not be allowed to delete themselves"
  );
  console.log("✅ Admin correctly denied deleting their own account.");

  console.log("🎉 Test passed: Admin Cannot Demote Self\n");
}

runAdminCannotDemoteSelfTest().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
