export const PROTECTED_SUPER_ADMIN_EMAIL = "nirlonmacwan27@gmail.com";

export const isProtectedSuperAdmin = (user) => {
  if (!user) return false;
  const email = (user.email || "").toLowerCase().trim();
  return email === PROTECTED_SUPER_ADMIN_EMAIL.toLowerCase().trim();
};

export const isSuperAdmin = (user) => {
  if (!user) return false;
  if (isProtectedSuperAdmin(user)) return true;
  return (user.role || "").toLowerCase().trim() === "super_admin";
};

export const isAdmin = (user) => {
  if (!user) return false;
  if (isSuperAdmin(user)) return true;
  return (user.role || "").toLowerCase().trim() === "admin";
};

/**
 * Calculates permissible admin actions for a target user row based on:
 * current logged in user, target user, roles, and protected Super Admin status.
 */
export const calculateUserActions = (currentUser, targetUser) => {
  const isTargetProtected = isProtectedSuperAdmin(targetUser);
  const isTargetSuperAdmin = isSuperAdmin(targetUser);
  const isSelf =
    (currentUser?._id && targetUser?._id && currentUser._id === targetUser._id) ||
    (currentUser?.id && targetUser?.id && currentUser.id === targetUser.id) ||
    (currentUser?.email &&
      targetUser?.email &&
      currentUser.email.toLowerCase().trim() === targetUser.email.toLowerCase().trim());

  const currentIsSuperAdmin = isSuperAdmin(currentUser);
  const currentIsAdmin = isAdmin(currentUser);

  // If target is protected root Super Admin: all modifications disabled
  if (isTargetProtected) {
    return {
      canDemote: false,
      canPromote: false,
      canBlock: false,
      canDelete: false,
      isProtected: true,
      roleDisplay: "👑 Super Admin (Protected)",
      roleBadgeClass: "role-super_admin protected",
      roleButtonTitle: "Protected Super Admin (Immutable)",
      blockButtonTitle: "Protected Super Admin cannot be blocked",
      deleteButtonTitle: "Protected Super Admin cannot be deleted",
    };
  }

  // If target is current logged-in account: no self demotion, self blocking, self deletion
  if (isSelf) {
    return {
      canDemote: false,
      canPromote: false,
      canBlock: false,
      canDelete: false,
      isProtected: false,
      isSelf: true,
      roleDisplay: isTargetSuperAdmin ? "👑 Super Admin" : "🛡️ Admin",
      roleBadgeClass: `role-${targetUser.role || "admin"}`,
      roleButtonTitle: "You cannot change your own role",
      blockButtonTitle: "You cannot block your own account",
      deleteButtonTitle: "You cannot delete your own account",
    };
  }

  // If target is another Super Admin (non-protected): nobody can change role or block
  if (isTargetSuperAdmin) {
    return {
      canDemote: false,
      canPromote: false,
      canBlock: false,
      canDelete: false,
      isProtected: false,
      roleDisplay: "👑 Super Admin",
      roleBadgeClass: "role-super_admin",
      roleButtonTitle: "Super Admin accounts cannot be altered",
      blockButtonTitle: "Super Admin accounts cannot be blocked",
      deleteButtonTitle: "Super Admin accounts cannot be deleted",
    };
  }

  // Target is another Admin:
  // Admin can demote another Admin to User!
  // Super Admin can demote another Admin to User!
  if (targetUser.role === "admin") {
    return {
      canDemote: currentIsAdmin || currentIsSuperAdmin,
      canPromote: false,
      canBlock: currentIsSuperAdmin,
      canDelete: currentIsSuperAdmin,
      isProtected: false,
      roleDisplay: "🛡️ Admin",
      roleBadgeClass: "role-admin",
      roleButtonTitle: "Demote to User",
      blockButtonTitle: currentIsSuperAdmin
        ? targetUser.isBlocked
          ? "Unblock Account"
          : "Block Account"
        : "Only Super Admin can block an Admin",
      deleteButtonTitle: currentIsSuperAdmin
        ? "Delete Account"
        : "Only Super Admin can delete an Admin",
    };
  }

  // Target is normal User:
  return {
    canDemote: false,
    canPromote: currentIsAdmin || currentIsSuperAdmin,
    canBlock: currentIsAdmin || currentIsSuperAdmin,
    canDelete: currentIsAdmin || currentIsSuperAdmin,
    isProtected: false,
    roleDisplay: "👤 User",
    roleBadgeClass: "role-user",
    roleButtonTitle: "Promote to Admin",
    blockButtonTitle: targetUser.isBlocked ? "Unblock Account" : "Block Account",
    deleteButtonTitle: "Delete Account",
  };
};