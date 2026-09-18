const { ROLES } = require("../constants/securityEvents");

/**
 * Role authorization middleware.
 * Enforces strict role checks with hierarchical inheritance:
 * - A route requiring 'admin' automatically permits 'super_admin'.
 * - A route requiring 'super_admin' strictly permits ONLY 'super_admin'.
 */
const roleMiddleware = (...roles) => {
  const allowedRoles = roles.map((r) => r.toLowerCase().trim());

  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Authentication required.",
      });
    }

    const userRole = (req.user.role || "").toLowerCase().trim();

    // Direct match
    if (allowedRoles.includes(userRole)) {
      return next();
    }

    // Hierarchical inheritance: SUPER_ADMIN has all ADMIN privileges
    if (userRole === ROLES.SUPER_ADMIN && allowedRoles.includes(ROLES.ADMIN)) {
      return next();
    }

    return res.status(403).json({
      success: false,
      message: "Access denied: Insufficient privileges.",
      requiredRoles: roles,
    });
  };
};

module.exports = roleMiddleware;