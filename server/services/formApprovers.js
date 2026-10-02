import sequelize from "../utilities/db.js";
import FormApprovers from "../Models/FormApprovers.js";
import Users from "../Models/Users.js";
import Forms from "../Models/Forms.js";
import { fail } from "../utilities/http.js";
import { APPROVER_ROLES, hasAnyRole } from "./formEntries/rules.js";

const LEVELS = ["first", "second", "third"];
const NONE = () => ({ first: false, second: false, third: false });

// A user's approval levels on every active form
export const getUserApprovals = async (userId) => {
  const user = await Users.findByPk(userId, {
    attributes: ["id", "user_firstname", "user_lastname", "user_groups"],
  });
  if (!user) fail(404, "User not found");

  const allForms = await Forms.findAll({
    where: { form_archivestatus: 0 },
    attributes: ["id", "form_name", "form_description"],
    order: [["form_name", "ASC"]],
  });
  const approvals = await FormApprovers.findAll({
    where: { user_id: userId, is_active: true },
    attributes: ["form_id", "approval_level"],
  });

  // { form_id: { first, second, third } }
  const byForm = {};
  for (const a of approvals) {
    byForm[a.form_id] ??= NONE();
    byForm[a.form_id][a.approval_level] = true;
  }

  return {
    user: {
      id: user.id,
      name: `${user.user_firstname} ${user.user_lastname}`,
      roles: user.user_groups,
    },
    forms: allForms.map((form) => ({
      form_id: form.id,
      form_name: form.form_name,
      form_description: form.form_description,
      assignments: byForm[form.id] || NONE(),
    })),
  };
};

// Replaces all of a user's assignments.
// assignments: [{ form_id, levels: ["first", "second"] }, …]
export const setUserApprovals = async (userId, assignments) => {
  const user = await Users.findByPk(userId, {
    attributes: ["id", "user_firstname", "user_lastname", "user_groups"],
  });
  if (!user) fail(404, "User not found");
  if (!Array.isArray(assignments)) fail(400, "Assignments must be an array");

  if (assignments.length > 0 && !hasAnyRole(user, APPROVER_ROLES)) {
    fail(
      400,
      "User must have 'approver', 'all_access', or 'qfd_admin' role to be assigned as an approver.",
    );
  }

  for (const assignment of assignments) {
    if (!assignment.form_id || !Array.isArray(assignment.levels)) {
      fail(400, "Each assignment must have form_id and levels array");
    }
    for (const level of assignment.levels) {
      if (!LEVELS.includes(level)) fail(400, `Invalid approval level: ${level}`);
    }
    if (!(await Forms.findByPk(assignment.form_id))) {
      fail(404, `Form with ID ${assignment.form_id} not found`);
    }
  }

  const rows = assignments.flatMap((a) =>
    a.levels.map((level) => ({
      form_id: a.form_id,
      user_id: userId,
      approval_level: level,
      is_active: true,
    })),
  );

  await sequelize.transaction(async (transaction) => {
    await FormApprovers.destroy({ where: { user_id: userId }, transaction });
    if (rows.length > 0) await FormApprovers.bulkCreate(rows, { transaction });
  });

  return rows.length;
};

// A form's approvers, grouped by level
export const getFormApprovers = async (formId) => {
  const form = await Forms.findByPk(formId, {
    attributes: ["id", "form_name", "form_description"],
  });
  if (!form) fail(404, "Form not found");

  const approvers = await FormApprovers.findAll({
    where: { form_id: formId, is_active: true },
    include: [
      {
        model: Users,
        as: "user",
        attributes: ["id", "user_firstname", "user_lastname", "user_email", "user_groups"],
      },
    ],
    order: [
      ["approval_level", "ASC"], // first, second, third
      [{ model: Users, as: "user" }, "user_firstname", "ASC"],
    ],
  });

  const byLevel = { first: [], second: [], third: [] };
  for (const a of approvers) {
    byLevel[a.approval_level].push({
      id: a.user.id,
      name: `${a.user.user_firstname} ${a.user.user_lastname}`,
      email: a.user.user_email,
      roles: a.user.user_groups,
    });
  }

  return {
    form: { id: form.id, name: form.form_name, description: form.form_description },
    approvers: byLevel,
  };
};

// Replaces all of a form's approvers. Every level must be sent explicitly so an
// empty or partial payload can't silently wipe them (clearing a level on
// purpose means sending an empty list for it).
// assignments: { first: [userId, …], second: […], third: […] }
export const setFormApprovers = async (formId, assignments) => {
  const form = await Forms.findByPk(formId);
  if (!form) fail(404, "Form not found");
  if (!assignments || typeof assignments !== "object") {
    fail(400, "assignments object is required");
  }

  const missing = LEVELS.filter((level) => !Array.isArray(assignments[level]));
  if (missing.length > 0) {
    fail(
      400,
      `assignments must include first, second and third as arrays (missing: ${missing.join(", ")})`,
    );
  }

  for (const level of LEVELS) {
    for (const userId of assignments[level]) {
      const user = await Users.findByPk(userId);
      if (!user || !hasAnyRole(user, APPROVER_ROLES)) {
        fail(400, `User ${userId} is not eligible to be an approver.`);
      }
    }
  }

  const rows = LEVELS.flatMap((level) =>
    assignments[level].map((userId) => ({
      form_id: formId,
      user_id: userId,
      approval_level: level,
      is_active: true,
    })),
  );

  await sequelize.transaction(async (transaction) => {
    await FormApprovers.destroy({ where: { form_id: formId }, transaction });
    if (rows.length > 0) await FormApprovers.bulkCreate(rows, { transaction });
  });

  return rows.length;
};
