const { USER, ADMIN, SUPER_ADMIN, SECURITY_TESTER } = require("../constants/roles");

const PROTECTED_SUPER_ADMIN_EMAIL = "nirlonmacwan27@gmail.com";

/**
 * Checks if a user is the permanently protected root Super Admin.
 * Checked server-side against the canonical protected email.
 */
const isProtectedSuperAdmin = (userOrEmail) => {
  if (!userOrEmail) return false;
  const email =
    typeof userOrEmail === "string"
      ? userOrEmail.toLowerCase().trim()
      : (userOrEmail.email || "").toLowerCase().trim();
  return email === PROTECTED_SUPER_ADMIN_EMAIL.toLowerCase().trim();
};

/**
 * Checks if a user possesses Super Admin privileges.
 */
const isSuperAdmin = (user) => {
  if (!user) return false;
  if (isProtectedSuperAdmin(user)) return true;
  const role = (user.role || "").toLowerCase().trim();
  return role === SUPER_ADMIN;
};

/**
 * Checks if a user possesses Admin or higher privileges.
 */
const isAdmin = (user) => {
  if (!user) return false;
  if (isSuperAdmin(user)) return true;
  const role = (user.role || "").toLowerCase().trim();
  return role === ADMIN;
};

/**
 * Determines whether an actor can change the role of a target user to a specific newRole.
 *
 * Rules:
 * - Protected Super Admin is IMMUTABLE (cannot be changed by anyone).
 * - Self-role modification is ALWAYS REJECTED.
 * - Super Admin accounts cannot be demoted by anyone (including self).
 * - Admin A -> Demote Admin B -> User: ALLOWED.
 * - Admin -> Super Admin: REJECTED (only Super Admin can promote to Super Admin).
 * - Super Admin -> promote User to Admin: ALLOWED.
 * - Super Admin -> demote Admin to User: ALLOWED.
 */
const canChangeRole = (actor, target, newRole) => {
  if (!actor || !target || !newRole) return { allowed: false, reason: "Invalid parameters." };

  const actorId = (actor._id || actor.id || "").toString();
  const targetId = (target._id || target.id || "").toString();

  // Self-modification rule: NEVER allowed
  if (actorId && targetId && actorId === targetId) {
    return { allowed: false, reason: "Self role modification is strictly prohibited." };
  }

  // Target is protected Super Admin: IMMUTABLE
  if (isProtectedSuperAdmin(target)) {
    return { allowed: false, reason: "The protected root Super Admin account cannot be modified." };
  }

  // Target is an existing Super Admin: nobody can demote a Super Admin
  if (isSuperAdmin(target)) {
    return { allowed: false, reason: "Super Admin accounts cannot be demoted or modified." };
  }

  const actorIsSuperAdmin = isSuperAdmin(actor);
  const actorIsAdmin = isAdmin(actor);

  if (!actorIsAdmin) {
    return { allowed: false, reason: "Access denied: Administrator privileges required." };
  }

  // Attempting to assign SUPER_ADMIN
  if (newRole === SUPER_ADMIN) {
    if (!actorIsSuperAdmin) {
      return { allowed: false, reason: "Only a Super Admin can promote users to Super Admin." };
    }
    return { allowed: true };
  }

  // Demoting another Admin to User
  if (target.role === ADMIN && newRole === USER) {
    // Both Admin and Super Admin can demote another Admin
    return { allowed: true };
  }

  // Promoting User to Admin
  if (target.role === USER && newRole === ADMIN) {
    // Both Admin and Super Admin can promote User to Admin
    return { allowed: true };
  }

  return { allowed: true };
};

/**
 * Determines whether an actor can block a target user.
 *
 * Rules:
 * - Protected Super Admin: NEVER blocked.
 * - Super Admin: NEVER blocked.
 * - Self-blocking: NEVER allowed.
 * - Admin can block normal User.
 * - Super Admin can block normal User or another Admin (if explicitly authorized).
 */
const canBlockUser = (actor, target) => {
  if (!actor || !target) return { allowed: false, reason: "Invalid user identifiers." };

  const actorId = (actor._id || actor.id || "").toString();
  const targetId = (target._id || target.id || "").toString();

  if (actorId && targetId && actorId === targetId) {
    return { allowed: false, reason: "Administrators cannot block their own account." };
  }

  if (isProtectedSuperAdmin(target)) {
    return { allowed: false, reason: "The protected root Super Admin account cannot be blocked." };
  }

  if (isSuperAdmin(target)) {
    return { allowed: false, reason: "Super Admin accounts cannot be blocked." };
  }

  const actorIsSuperAdmin = isSuperAdmin(actor);
  const actorIsAdmin = isAdmin(actor);

  if (!actorIsAdmin) {
    return { allowed: false, reason: "Insufficient privileges to block accounts." };
  }

  // An ordinary admin cannot block another admin
  if (target.role === ADMIN && !actorIsSuperAdmin) {
    return { allowed: false, reason: "Only Super Admin accounts may block administrator accounts." };
  }

  return { allowed: true };
};

/**
 * Determines whether an actor can delete a target user account.
 *
 * Rules:
 * - Protected Super Admin: NEVER deleted.
 * - Super Admin: NEVER deleted.
 * - Self-deletion: NEVER allowed through admin management.
 * - Admin can delete normal User.
 * - Super Admin can delete normal User or another Admin.
 */
const canDeleteUser = (actor, target) => {
  if (!actor || !target) return { allowed: false, reason: "Invalid user identifiers." };

  const actorId = (actor._id || actor.id || "").toString();
  const targetId = (target._id || target.id || "").toString();

  if (actorId && targetId && actorId === targetId) {
    return { allowed: false, reason: "Administrators cannot delete their own account from the directory." };
  }

  if (isProtectedSuperAdmin(target)) {
    return { allowed: false, reason: "The protected root Super Admin account cannot be deleted." };
  }

  if (isSuperAdmin(target)) {
    return { allowed: false, reason: "Super Admin accounts cannot be deleted." };
  }

  const actorIsSuperAdmin = isSuperAdmin(actor);
  const actorIsAdmin = isAdmin(actor);

  if (!actorIsAdmin) {
    return { allowed: false, reason: "Insufficient privileges to delete accounts." };
  }

  if (target.role === ADMIN && !actorIsSuperAdmin) {
    return { allowed: false, reason: "Only Super Admin accounts may delete administrator accounts." };
  }

  return { allowed: true };
};

module.exports = {
  PROTECTED_SUPER_ADMIN_EMAIL,
  isProtectedSuperAdmin,
  isSuperAdmin,
  isAdmin,
  canChangeRole,
  canBlockUser,
  canDeleteUser,
  ROLES: { USER, ADMIN, SUPER_ADMIN, SECURITY_TESTER },
  USER,
  ADMIN,
  SUPER_ADMIN,
  SECURITY_TESTER,
};
