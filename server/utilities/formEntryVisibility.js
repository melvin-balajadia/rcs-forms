import { Op } from "sequelize";
import Users from "../Models/Users.js";
import FormApprovers from "../Models/FormApprovers.js";
import FormEntries from "../Models/FormEntries.js";

// Resolves the authenticated user (from verifyJWT's req.user_name) and
// returns the FormEntries visibility scope for them:
//   - requestor: only entries they created
//   - approver: also entries for forms they're an active approver on (any
//     level), across the entry's whole lifecycle except draft/pending
//   - all_access / qfd_admin: unrestricted (condition: null)
export const getFormEntryVisibility = async (req) => {
  const currentUser = await Users.findOne({
    where: { user_username: req.user_name },
  });

  if (!currentUser) {
    // No matching user for this token — show nothing rather than everything.
    return { currentUser: null, isAdmin: false, condition: { id: -1 } };
  }

  const roles = Array.isArray(currentUser.user_groups)
    ? currentUser.user_groups
    : [];
  const isAdmin = roles.includes("all_access") || roles.includes("qfd_admin");

  if (isAdmin) {
    return { currentUser, isAdmin: true, condition: null };
  }

  const visibilityConditions = [{ user_id: currentUser.id }];

  if (roles.includes("approver")) {
    const assignments = await FormApprovers.findAll({
      where: { user_id: currentUser.id, is_active: true },
    });

    const assignedFormIds = [...new Set(assignments.map((a) => a.form_id))];

    for (const formId of assignedFormIds) {
      visibilityConditions.push({
        form_id: formId,
        form_entry_status: { [Op.notIn]: ["draft", "pending"] },
      });
    }
  }

  return {
    currentUser,
    isAdmin: false,
    condition: { [Op.or]: visibilityConditions },
  };
};

// Loads one entry only if the caller may see it (same rules as the list).
// Returns null otherwise, so callers answer 404 without revealing whether the
// entry exists.
export const findVisibleEntry = async (req, id, options = {}) => {
  const { currentUser, condition } = await getFormEntryVisibility(req);
  if (!currentUser) return null;

  return FormEntries.findOne({
    ...options,
    where: { id, ...(condition ? { [Op.and]: [condition] } : {}) },
  });
};
