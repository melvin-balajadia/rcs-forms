// Must run after verifyJWT (which loads req.user). Allows the request only if
// the caller holds at least one of the given roles.
export const hasRole = (user, ...allowedRoles) => {
  const roles = Array.isArray(user?.user_groups) ? user.user_groups : [];
  return roles.some((role) => allowedRoles.includes(role));
};

const requireRole =
  (...allowedRoles) =>
  (req, res, next) => {
    if (!hasRole(req.user, ...allowedRoles)) {
      return res.status(403).json({
        ErrorMessage: "You don't have permission to perform this action.",
        ErrorState: true,
      });
    }
    next();
  };

// Shorthands for the role groups used across routes
export const ADMINS = ["all_access", "qfd_admin"];
export const APPROVERS = ["approver", ...ADMINS];

export default requireRole;
