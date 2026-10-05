import sequelize from "../../utilities/db.js";
import FormEntries from "../../Models/FormEntries.js";
import Forms from "../../Models/Forms.js";
import FormQuestionValue from "../../Models/FormQuestionValue.js";
import { CREATE_STATUSES, canEditTo } from "../../utilities/entryStatus.js";
import { fail } from "../../utilities/http.js";
import {
  ENTRY_AUTHOR_ROLES,
  checkEntryDetails,
  hasAnyRole,
  rolesOf,
} from "./rules.js";
import { saveAnswers } from "./answers.js";

// Creates an entry owned by `user` with its answers (create-builder).
// Returns { entry, answers, status }.
export const createEntry = async (user, body) => {
  const {
    form_id,
    form_entry_site,
    form_entry_area,
    form_entry_date,
    form_entry_status = "pending",
    responses,
  } = body;

  const roles = rolesOf(user);
  if (roles.length === 0) {
    fail(
      403,
      "Your account does not have a role assigned. Please contact your administrator.",
    );
  }
  if (!hasAnyRole(user, ENTRY_AUTHOR_ROLES)) {
    fail(
      403,
      `You don't have permission to create form entries. Your current roles are: ${roles.join(", ")}`,
    );
  }

  // Archived forms can't receive new entries
  const form = await Forms.findOne({ where: { id: form_id, form_archivestatus: 0 } });
  if (!form) fail(400, "Invalid form_id");

  // New entries start as draft or pending; approval stages are reached only
  // through submit-approval and approve
  if (!CREATE_STATUSES.includes(form_entry_status)) {
    fail(
      400,
      `Invalid status '${form_entry_status}'. Must be one of: ${CREATE_STATUSES.join(", ")}.`,
    );
  }

  await checkEntryDetails(form_entry_status, { form_id, ...body }, ["draft"]);

  return sequelize.transaction(async (transaction) => {
    const entry = await FormEntries.create(
      {
        user_id: user.id, // always the logged-in user
        form_id,
        form_entry_site: form_entry_site || null,
        form_entry_area: form_entry_area || null,
        form_entry_date: form_entry_date || null,
        form_entry_archivestatus: 0, // only admins archive, via /archive
        form_entry_status,
      },
      { transaction },
    );

    const answers = await saveAnswers({
      formId: form_id,
      entryId: entry.id,
      responses,
      transaction,
    });

    return { entry, answers, status: form_entry_status };
  });
};

// Updates the owner's entry and its answers (update-builder). The entry comes
// from the URL, and its answers always belong to the entry's own form.
// Returns { entry, answers, status }.
export const updateEntry = async (user, entryId, body) => {
  const {
    form_entry_site,
    form_entry_area,
    form_entry_date,
    form_entry_status = "draft",
    responses,
  } = body;

  const entry = await FormEntries.findByPk(entryId);
  if (!entry) fail(404, "Form entry not found");

  if (!hasAnyRole(user, ENTRY_AUTHOR_ROLES)) {
    fail(403, "You don't have permission to update form entries");
  }
  if (entry.user_id !== user.id) fail(403, "Unauthorized to update this entry");

  const form_id = entry.form_id;

  // Only the edits the workflow allows (entries in an approval stage,
  // completed or rejected can't be edited)
  const currentStatus = entry.form_entry_status;
  if (!canEditTo(currentStatus, form_entry_status)) {
    fail(
      400,
      `An entry that is '${currentStatus}' can't be saved as '${form_entry_status}'.`,
    );
  }

  await checkEntryDetails(form_entry_status, { ...body, form_id }, [
    "draft",
    "returned",
  ]);

  return sequelize.transaction(async (transaction) => {
    entry.form_entry_site = form_entry_site || entry.form_entry_site;
    entry.form_entry_area = form_entry_area || entry.form_entry_area;
    entry.form_entry_date = form_entry_date || entry.form_entry_date;
    entry.form_entry_status = form_entry_status;
    await entry.save({ transaction });

    const existingValues = await FormQuestionValue.findAll({
      where: { form_entry_id: entryId },
      transaction,
    });

    const answers = await saveAnswers({
      formId: form_id,
      entryId,
      responses,
      existingValues,
      transaction,
    });

    return { entry, answers, status: form_entry_status };
  });
};
