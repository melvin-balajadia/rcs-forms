// The one set of rules for which role combinations a user may have — used by
// create user, edit user and the Users model.

export const VALID_ROLES = ["requestor", "approver", "all_access", "qfd_admin"];

// Returns why a role list is invalid, or null when it's fine.
//   listValidRoles: append the valid roles to the "Invalid roles" message
//                   (create user has always done this; edit user hasn't)
export const roleListError = (groups, { listValidRoles = false } = {}) => {
  if (!Array.isArray(groups) || groups.length === 0) {
    return "User must have at least one role!";
  }

  const invalid = groups.filter((role) => !VALID_ROLES.includes(role));
  if (invalid.length > 0) {
    return listValidRoles
      ? `Invalid roles: ${invalid.join(", ")}. Valid roles are: ${VALID_ROLES.join(", ")}`
      : `Invalid roles: ${invalid.join(", ")}`;
  }

  const has = (role) => groups.includes(role);
  if (has("all_access") && groups.length > 1) {
    return "all_access cannot be combined with other roles.";
  }
  if (has("qfd_admin") && groups.length > 1) {
    return "qfd_admin cannot be combined with other roles.";
  }
  if (has("requestor") && has("approver")) {
    return "A requestor cannot also be an approver.";
  }
  if (has("requestor") && groups.length > 1) {
    return "Requestor must be a single role.";
  }
  return null;
};
