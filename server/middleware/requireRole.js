import Users from "../Models/Users.js";

// Must run after verifyJWT. Loads the caller from req.user_name and allows the
// request only if they hold at least one of the given roles.
const requireRole =
  (...allowedRoles) =>
  async (req, res, next) => {
    const currentUser = await Users.findOne({
      where: { user_username: req.user_name },
    });

    const roles = Array.isArray(currentUser?.user_groups)
      ? currentUser.user_groups
      : [];

    if (!roles.some((role) => allowedRoles.includes(role))) {
      return res.status(403).json({
        ErrorMessage: "You don't have permission to perform this action.",
        ErrorState: true,
      });
    }

    req.currentUser = currentUser;
    next();
  };

export default requireRole;
