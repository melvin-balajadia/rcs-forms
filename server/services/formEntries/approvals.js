import sequelize from "../../utilities/db.js";
import FormEntries from "../../Models/FormEntries.js";
import Forms from "../../Models/Forms.js";
import FormApprovers from "../../Models/FormApprovers.js";
import { fail } from "../../utilities/http.js";
import {
  APPROVAL_STAGES,
  APPROVER_ROLES,
  SUPER_APPROVER_ROLES,
  hasAnyRole,
} from "./rules.js";

const withForm = {
  include: [{ model: Forms, attributes: ["id", "form_name"] }],
};

const fullName = (user) => `${user.user_firstname} ${user.user_lastname}`;

// all_access and qfd_admin act at any level without an assignment; everyone
// else must be an active approver for this form at this level
const assertAssigned = async (user, entry, level) => {
  if (hasAnyRole(user, SUPER_APPROVER_ROLES)) return;
  const assigned = await FormApprovers.findOne({
    where: {
      form_id: entry.form_id,
      user_id: user.id,
      approval_level: level,
      is_active: true,
    },
  });
  if (!assigned) {
    fail(403, `You are not assigned as a ${level} approver for this form.`);
  }
};

// pending → submitted_first. Requestors submit only their own entries; admins
// may submit anyone's.
export const submitEntry = async (user, { form_entry_id }) => {
  if (!form_entry_id) fail(400, "form_entry_id is required");

  const entry = await FormEntries.findByPk(form_entry_id);
  if (!entry) fail(404, "Form entry not found");

  const roles = (Array.isArray(user.user_groups) ? user.user_groups : []).map(
    (r) => r.toLowerCase().trim(),
  );
  const isRequestor = roles.includes("requestor");
  const isAdmin = roles.includes("qfd_admin") || roles.includes("all_access");

  if (!isRequestor && !isAdmin) {
    fail(403, "You don't have permission to submit this form");
  }
  if (isRequestor && entry.user_id !== user.id) {
    fail(403, "You can only submit your own form");
  }

  const currentStatus = entry.form_entry_status;
  if (currentStatus !== "pending") {
    fail(400, `Form cannot be submitted. Current status: '${currentStatus}'`);
  }

  const isResubmission = entry.form_entry_return_count > 0;
  await entry.update({
    form_entry_status: "submitted_first",
    ...(isResubmission && { form_entry_resubmitted_datetime: new Date() }),
  });

  return {
    message: isResubmission
      ? "Form resubmitted for approval successfully"
      : "Form submitted for approval successfully",
    formEntry: { id: entry.id, status: "submitted_first", isResubmission },
  };
};

// Approve (to the next stage) or reject, at the entry's current stage
export const decideEntry = async (user, { form_entry_id, action, remarks }) => {
  if (!["approve", "reject"].includes(action)) {
    fail(400, "Invalid action. Must be 'approve' or 'reject'");
  }

  const entry = await FormEntries.findByPk(form_entry_id, withForm);
  if (!entry) fail(404, "Form entry not found");

  const currentStatus = entry.form_entry_status;
  const stage = APPROVAL_STAGES[currentStatus];
  if (!stage) {
    fail(
      400,
      `Form entry is not awaiting approval. Current status: '${currentStatus}'`,
    );
  }
  if (!hasAnyRole(user, APPROVER_ROLES)) {
    fail(403, "You don't have permission to approve form entries.");
  }
  await assertAssigned(user, entry, stage.level);

  const newStatus = action === "approve" ? stage.approvedStatus : "rejected";
  const update =
    action === "approve"
      ? {
          form_entry_status: newStatus,
          [stage.idField]: user.id,
          [stage.datetimeField]: new Date(),
          [stage.remarksField]: remarks || null,
        }
      : {
          form_entry_status: newStatus,
          form_entry_rejector_id: user.id,
          form_entry_rejector_datetime: new Date(),
          form_entry_rejector_remarks: remarks || null,
        };

  await sequelize.transaction((transaction) => entry.update(update, { transaction }));

  return {
    message: `Form entry ${action}${action === "approve" ? "d" : "ed"} at ${stage.level} approval stage`,
    formEntry: {
      id: entry.id,
      form_id: entry.form_id,
      form_name: entry.Form?.form_name,
      previousStatus: currentStatus,
      newStatus,
      approvalStage: stage.level,
    },
    approver: { id: user.id, name: fullName(user) },
  };
};

// Return to the requestor for corrections, from any approval stage. Approval
// data is kept so the history stays complete; a resubmission starts a new
// approval cycle that overwrites it.
export const returnEntry = async (user, { form_entry_id, remarks }) => {
  if (!form_entry_id) fail(400, "form_entry_id is required");

  const entry = await FormEntries.findByPk(form_entry_id, withForm);
  if (!entry) fail(404, "Form entry not found");

  if (!hasAnyRole(user, APPROVER_ROLES)) {
    fail(403, "You don't have permission to return form entries.");
  }

  const currentStatus = entry.form_entry_status;
  const stage = APPROVAL_STAGES[currentStatus];
  if (!stage) {
    fail(400, `Form cannot be returned. Current status: '${currentStatus}'`);
  }
  await assertAssigned(user, entry, stage.level);

  await sequelize.transaction((transaction) =>
    entry.update(
      {
        form_entry_status: "returned",
        form_entry_returner_id: user.id,
        form_entry_returner_datetime: new Date(),
        form_entry_returner_remarks: remarks || null,
        form_entry_return_count: entry.form_entry_return_count + 1,
        form_entry_last_return_level: stage.level,
      },
      { transaction },
    ),
  );

  return {
    message: `Form entry returned successfully. Requestor can now edit and resubmit.`,
    formEntry: {
      id: entry.id,
      form_id: entry.form_id,
      form_name: entry.Form?.form_name,
      previousStatus: currentStatus,
      newStatus: "returned",
      returnLevel: stage.level,
      // `entry` already holds the incremented count after the update above
      returnCount: entry.form_entry_return_count,
    },
    returner: { id: user.id, name: fullName(user) },
  };
};
