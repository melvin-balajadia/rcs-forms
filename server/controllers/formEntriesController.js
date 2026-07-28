import FormEntries from "../Models/FormEntries.js";
import Forms from "../Models/Forms.js";
import Users from "../Models/Users.js";
import FormQuestionValue from "../Models/FormQuestionValue.js";
import FormQuestionSubValue from "../Models/FormQuestionSubValue.js";
import FormSection from "../Models/FormSection.js";
import FormApprovers from "../Models/FormApprovers.js";
import Question from "../Models/Questions.js";
import SubQuestion from "../Models/SubQuestion.js";
import { Op } from "sequelize";
import sequelize from "../utilities/db.js";
import { getFormEntryVisibility } from "../utilities/formEntryVisibility.js";

// ✅ Cross-checks a form's required questions/sub-questions against the
// submitted responses, returning the text of any that are missing/blank.
const findMissingRequiredAnswers = async (form_id, responses) => {
  const requiredQuestions = await Question.findAll({
    where: { form_id, form_questions_archivestatus: 0, required: true },
    attributes: ["id", "form_questions"],
  });

  const requiredSubQuestions = await SubQuestion.findAll({
    where: { required: true, sub_question_archivestatus: 0 },
    include: [
      {
        model: Question,
        as: "question",
        where: { form_id, form_questions_archivestatus: 0 },
        attributes: [],
      },
    ],
    attributes: ["sub_question_id", "sub_questions"],
  });

  const responseByQuestion = new Map(
    (responses || []).map((r) => [Number(r.form_question_id), r]),
  );
  const subValueBySubQuestion = new Map();
  for (const r of responses || []) {
    for (const sv of r.sub_values || []) {
      subValueBySubQuestion.set(Number(sv.sub_question_id), sv);
    }
  }

  const missing = [];

  for (const q of requiredQuestions) {
    const r = responseByQuestion.get(q.id);
    if (!r || !String(r.form_value ?? "").trim()) {
      missing.push(q.form_questions);
    }
  }

  for (const sq of requiredSubQuestions) {
    const sv = subValueBySubQuestion.get(sq.sub_question_id);
    if (!sv || !String(sv.form_sub_value ?? "").trim()) {
      missing.push(sq.sub_questions);
    }
  }

  return missing;
};

// Get all form entries
export const getFormEntries = async (req, res) => {
  try {
    const entries = await FormEntries.findAll({ include: Users });
    res.status(200).json(entries);
  } catch (error) {
    res.status(500).json({ message: "Error fetching form entries", error });
  }
};

// Get a single form entry by ID
export const getFormEntryById = async (req, res) => {
  try {
    const entry = await FormEntries.findByPk(req.params.id, {
      include: [
        Users,
        Forms,
        {
          model: Users,
          as: "returner",
          attributes: ["id", "user_firstname", "user_lastname"],
        },
      ],
    });
    if (!entry)
      return res.status(404).json({ message: "Form entry not found" });

    res.status(200).json(entry);
  } catch (error) {
    res.status(500).json({ message: "Error fetching form entry", error });
  }
};

// Delete a form entry
export const deleteFormEntry = async (req, res) => {
  try {
    const entry = await FormEntries.findByPk(req.params.id);
    if (!entry)
      return res.status(404).json({ message: "Form entry not found" });

    await entry.destroy();
    res.status(200).json({ message: "Form entry deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error deleting form entry", error });
  }
};

// Get Form Entries with Pagination and Filtering
export const formEntriesPagination = async (req, res) => {
  try {
    // Pagination Params
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 10;
    const offset = (page - 1) * pageSize;

    // Filter Params
    const { id, user_id, form_id, site, area, from, to, status } = req.query;
    const whereCondition = {};

    if (id) {
      whereCondition.id = id;
    }

    if (form_id) {
      whereCondition.form_id = form_id;
    }

    if (site) {
      whereCondition.form_entry_site = { [Op.like]: `%${site}%` };
    }

    if (area) {
      whereCondition.form_entry_area = { [Op.like]: `%${area}%` };
    }

    if (from && to) {
      whereCondition.form_entry_date = { [Op.between]: [from, to] };
    }

    // ✅ Status filter — accepts a single status or a comma-separated list
    // (some display labels like "Awaiting 2nd Approval" map to more than
    // one underlying status value).
    if (status) {
      const statuses = String(status)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (statuses.length > 0) {
        whereCondition.form_entry_status = { [Op.in]: statuses };
      }
    }

    // ✅ Scope visibility to the authenticated user: requestors only see
    // entries they created, approvers also see entries awaiting their
    // approval, all_access/qfd_admin see everything.
    const { currentUser, isAdmin, condition } =
      await getFormEntryVisibility(req);
    if (!currentUser) {
      return res.status(401).json({ message: "Invalid session" });
    }

    if (isAdmin) {
      // Admins may still narrow the list to a specific requestor
      if (user_id) {
        whereCondition.user_id = user_id;
      }
    } else {
      whereCondition[Op.and] = [condition];
    }

    // Fetch paginated data with relations
    const { rows: entries, count } = await FormEntries.findAndCountAll({
      where: whereCondition,
      include: [
        {
          model: Users,
          attributes: [
            "id",
            "user_username",
            "user_email",
            "user_firstname",
            "user_lastname",
          ],
        },
        { model: Forms, attributes: ["id", "form_name"] },
      ],
      order: [["id", "DESC"]],
      limit: pageSize,
      offset,
    });

    res.status(200).json({
      message: "Form entries fetched successfully",
      total: count,
      totalPages: Math.ceil(count / pageSize),
      currentPage: page,
      pageSize,
      entries,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching paginated form entries", error });
  }
};

export const createFormEntryBuilder = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const {
      user_id,
      form_id,
      form_entry_site,
      form_entry_area,
      form_entry_date,
      form_entry_archivestatus,
      form_entry_status = "pending",
      responses, // [{ form_question_id, form_value, remarks, action_item, sub_values: [] }]
    } = req.body;

    const validSites = ["Taytay", "Cabuyao", "Plaridel", "Marilao", "Villasis"];
    const validStatuses = [
      "draft",
      "pending",
      "submitted_first",
      "submitted_second",
      "submitted_third",
      "completed",
      "rejected",
    ];

    // 1️⃣ Validate user + form
    const user = await Users.findByPk(user_id, {
      attributes: [
        "id",
        "user_firstname",
        "user_lastname",
        "user_groups",
        "user_email",
      ],
    });

    if (!user) {
      return res.status(400).json({ message: "Invalid user_id" });
    }

    const userRoles = user.user_groups || [];

    if (!Array.isArray(userRoles) || userRoles.length === 0) {
      return res.status(403).json({
        message:
          "Your account does not have a role assigned. Please contact your administrator.",
      });
    }

    const isRequestor =
      userRoles.includes("requestor") ||
      userRoles.includes("all_access") ||
      userRoles.includes("qfd_admin");

    if (!isRequestor) {
      return res.status(403).json({
        message: `You don't have permission to create form entries. Your current roles are: ${userRoles.join(", ")}`,
      });
    }

    const form = await Forms.findByPk(form_id);
    if (!form) return res.status(400).json({ message: "Invalid form_id" });

    // 2️⃣ Validate status
    if (!validStatuses.includes(form_entry_status)) {
      return res.status(400).json({
        message: `Invalid status '${form_entry_status}'. Must be one of: ${validStatuses.join(", ")}.`,
      });
    }

    // 3️⃣ Validate user_groups exists if status requires approval
    if (
      ["submitted_first", "submitted_second", "submitted_third"].includes(
        form_entry_status,
      )
    ) {
      if (!userRoles || userRoles.length === 0) {
        return res.status(400).json({
          message:
            "User does not have approvers configured. Please contact administrator.",
        });
      }
    }

    // 4️⃣ CONDITIONAL VALIDATION based on status
    if (form_entry_status === "pending" || form_entry_status === "completed") {
      // STRICT validation for pending/completed forms
      if (!form_entry_site) {
        return res
          .status(400)
          .json({ message: "Site is required for submitted forms" });
      }
      if (!validSites.includes(form_entry_site)) {
        return res.status(400).json({
          message: `Invalid site value '${form_entry_site}'. Must be one of: ${validSites.join(", ")}.`,
        });
      }
      if (!form_entry_area) {
        return res
          .status(400)
          .json({ message: "Area is required for submitted forms" });
      }
      if (!form_entry_date) {
        return res
          .status(400)
          .json({ message: "Date is required for submitted forms" });
      }
      if (!responses || responses.length === 0) {
        return res.status(400).json({
          message: "At least one response is required for submitted forms",
        });
      }

      const missingRequired = await findMissingRequiredAnswers(
        form_id,
        responses,
      );
      if (missingRequired.length > 0) {
        return res.status(400).json({
          message: `Please answer all required questions before submitting: ${missingRequired.join(", ")}`,
        });
      }
    } else if (form_entry_status === "draft") {
      // RELAXED validation for drafts - only validate format if provided
      if (form_entry_site && !validSites.includes(form_entry_site)) {
        return res.status(400).json({
          message: `Invalid site value '${form_entry_site}'. Must be one of: ${validSites.join(", ")}.`,
        });
      }
    }

    // 5️⃣ Create form entry with status
    const newEntry = await FormEntries.create(
      {
        user_id,
        form_id,
        form_entry_site: form_entry_site || null,
        form_entry_area: form_entry_area || null,
        form_entry_date: form_entry_date || null,
        form_entry_archivestatus: form_entry_archivestatus ?? 0,
        form_entry_status,
      },
      { transaction: t },
    );

    // 6️⃣ Process responses (if any provided)
    let createdValues = [];
    if (responses && responses.length > 0) {
      // Validate & insert question values
      const questionIds = responses.map((r) => r.form_question_id);
      const validQuestions = await Question.findAll({
        where: { id: questionIds, form_id },
      });

      const validQuestionIds = validQuestions.map((q) => q.id);
      const invalid = questionIds.filter(
        (id) => !validQuestionIds.includes(id),
      );
      if (invalid.length > 0) {
        await t.rollback();
        return res.status(400).json({
          message: "Some question IDs are not part of this form",
          invalid,
        });
      }

      // 7️⃣ Insert answers with action_item
      for (const resp of responses) {
        const q = validQuestions.find((q) => q.id === resp.form_question_id);

        const value = await FormQuestionValue.create(
          {
            form_id,
            form_entry_id: newEntry.id,
            form_question_id: resp.form_question_id,
            form_section_id: q.form_section_id,
            form_value: resp.form_value,
            remarks: resp.remarks,
            action_item: resp.action_item || null,
          },
          { transaction: t },
        );

        // 8️⃣ Insert sub-values if any
        if (Array.isArray(resp.sub_values) && resp.sub_values.length > 0) {
          const subVals = resp.sub_values.map((sub) => ({
            form_id,
            form_question_id: resp.form_question_id, // parent question ID
            sub_question_id: sub.sub_question_id, // ✅ specific sub-question ID
            form_question_value_id: value.id,
            form_sub_value: sub.form_sub_value,
            remarks: sub.remarks || null,
            action_item: sub.action_item || null,
          }));
          await FormQuestionSubValue.bulkCreate(subVals, { transaction: t });
        }

        createdValues.push(value);
      }
    }

    await t.commit();

    return res.status(201).json({
      message: `Form entry saved as ${form_entry_status} successfully`,
      entry: newEntry,
      answers: createdValues,
    });
  } catch (error) {
    await t.rollback();
    console.error("Error in createFormEntryBuilder:", error);
    res.status(500).json({
      message: "Error creating form entry with answers",
      error: error.message,
    });
  }
};

// Get all question values for a specific form entry
export const getQuestionValuesByEntryId = async (req, res) => {
  try {
    const { entryId } = req.params;

    const questionValues = await FormQuestionValue.findAll({
      where: { form_entry_id: entryId },
      include: [
        {
          model: FormQuestionSubValue,
          foreignKey: "form_question_value_id",
          required: false,
          include: [
            {
              model: SubQuestion,
              foreignKey: "sub_question_id",
              attributes: [
                "sub_question_id",
                "question_id",
                "sub_questions",
                "question_type",
              ],
              required: false,
            },
          ],
        },
      ],
      order: [
        ["form_section_id", "ASC"],
        ["form_question_id", "ASC"],
      ],
    });

    res.status(200).json(questionValues);
  } catch (error) {
    console.error("Error fetching question values:", error);
    res.status(500).json({
      message: "Error fetching question values",
      error: error.message,
      stack: error.stack,
    });
  }
};

// Update Form Entry (for updating existing drafts)
export const updateFormEntryBuilder = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const {
      form_entry_id,
      user_id,
      form_id,
      form_entry_site,
      form_entry_area,
      form_entry_date,
      form_entry_archivestatus,
      form_entry_status = "draft",
      responses, // [{ form_question_id, form_value, remarks, action_item, sub_values: [] }]
    } = req.body;

    const validSites = ["Taytay", "Cabuyao", "Plaridel", "Marilao", "Villasis"];
    const validStatuses = [
      "draft",
      "pending",
      "returned",
      "submitted_first",
      "submitted_second",
      "submitted_third",
      "completed",
      "rejected",
    ];

    // 1️⃣ Find existing form entry
    const existingEntry = await FormEntries.findByPk(form_entry_id);
    if (!existingEntry) {
      return res.status(404).json({ message: "Form entry not found" });
    }

    // 2️⃣ Get user and verify role
    const user = await Users.findByPk(user_id);
    if (!user) {
      return res.status(400).json({ message: "Invalid user_id" });
    }

    const userGroups = user.user_groups || [];
    const canUpdate =
      userGroups.includes("requestor") ||
      userGroups.includes("all_access") ||
      userGroups.includes("qfd_admin");

    if (!Array.isArray(userGroups) || !canUpdate) {
      return res.status(403).json({
        message: "You don't have permission to update form entries",
      });
    }

    // 3️⃣ Security: Verify ownership
    if (existingEntry.user_id !== user_id) {
      return res
        .status(403)
        .json({ message: "Unauthorized to update this entry" });
    }

    // 4️⃣ Validate status
    if (!validStatuses.includes(form_entry_status)) {
      return res.status(400).json({
        message: `Invalid status '${form_entry_status}'. Must be one of: ${validStatuses.join(", ")}.`,
      });
    }

    // 5️⃣ Conditional validation based on status
    if (form_entry_status === "pending" || form_entry_status === "completed") {
      // STRICT validation for pending/completed forms
      if (!form_entry_site) {
        return res
          .status(400)
          .json({ message: "Site is required for submitted forms" });
      }
      if (!validSites.includes(form_entry_site)) {
        return res.status(400).json({
          message: `Invalid site value '${form_entry_site}'. Must be one of: ${validSites.join(", ")}.`,
        });
      }
      if (!form_entry_area) {
        return res
          .status(400)
          .json({ message: "Area is required for submitted forms" });
      }
      if (!form_entry_date) {
        return res
          .status(400)
          .json({ message: "Date is required for submitted forms" });
      }
      if (!responses || responses.length === 0) {
        return res.status(400).json({
          message: "At least one response is required for submitted forms",
        });
      }

      const missingRequired = await findMissingRequiredAnswers(
        form_id || existingEntry.form_id,
        responses,
      );
      if (missingRequired.length > 0) {
        return res.status(400).json({
          message: `Please answer all required questions before submitting: ${missingRequired.join(", ")}`,
        });
      }
    } else if (form_entry_status === "draft" || form_entry_status === "returned") {
      // RELAXED validation for drafts and returned entries being edited
      if (form_entry_site && !validSites.includes(form_entry_site)) {
        return res.status(400).json({
          message: `Invalid site value '${form_entry_site}'. Must be one of: ${validSites.join(", ")}.`,
        });
      }
    }

    // 6️⃣ Update form entry metadata
    existingEntry.form_entry_site =
      form_entry_site || existingEntry.form_entry_site;
    existingEntry.form_entry_area =
      form_entry_area || existingEntry.form_entry_area;
    existingEntry.form_entry_date =
      form_entry_date || existingEntry.form_entry_date;
    existingEntry.form_entry_archivestatus =
      form_entry_archivestatus ?? existingEntry.form_entry_archivestatus;
    existingEntry.form_entry_status = form_entry_status;
    await existingEntry.save({ transaction: t });

    // 7️⃣ Get existing question values
    const existingValues = await FormQuestionValue.findAll({
      where: { form_entry_id: form_entry_id },
    });

    // Create a map of existing values by question_id for quick lookup
    const existingValuesMap = new Map();
    existingValues.forEach((val) => {
      existingValuesMap.set(val.form_question_id, val);
    });

    // 8️⃣ Process responses (update existing, create new)
    let updatedValues = [];
    if (responses && responses.length > 0) {
      // Validate questions
      const questionIds = responses.map((r) => r.form_question_id);
      const validQuestions = await Question.findAll({
        where: { id: questionIds, form_id },
      });

      const validQuestionIds = validQuestions.map((q) => q.id);
      const invalid = questionIds.filter(
        (id) => !validQuestionIds.includes(id),
      );
      if (invalid.length > 0) {
        await t.rollback();
        return res.status(400).json({
          message: "Some question IDs are not part of this form",
          invalid,
        });
      }

      // 9️⃣ Update or create question values
      for (const resp of responses) {
        const q = validQuestions.find((q) => q.id === resp.form_question_id);
        const existingValue = existingValuesMap.get(resp.form_question_id);

        let value;
        if (existingValue) {
          existingValue.form_value = resp.form_value;
          existingValue.remarks = resp.remarks;
          existingValue.action_item = resp.action_item || null;
          await existingValue.save({ transaction: t });
          value = existingValue;
        } else {
          value = await FormQuestionValue.create(
            {
              form_id,
              form_entry_id: form_entry_id,
              form_question_id: resp.form_question_id,
              form_section_id: q.form_section_id,
              form_value: resp.form_value,
              remarks: resp.remarks,
              action_item: resp.action_item || null,
            },
            { transaction: t },
          );
        }

        // 🔟 Handle sub-values (delete old ones, insert new ones)
        if (Array.isArray(resp.sub_values)) {
          await FormQuestionSubValue.destroy({
            where: {
              form_question_id: resp.form_question_id,
              form_question_value_id: value.id,
            },
            transaction: t,
          });

          if (resp.sub_values.length > 0) {
            // Validate sub_question_ids belong to this parent question
            const subQuestionIds = resp.sub_values
              .map((s) => s.sub_question_id)
              .filter(Boolean);

            if (subQuestionIds.length > 0) {
              const validSubQuestions = await SubQuestion.findAll({
                where: {
                  sub_question_id: subQuestionIds,
                  question_id: resp.form_question_id, //  must belong to the parent
                },
              });

              const validSubIds = validSubQuestions.map(
                (sq) => sq.sub_question_id,
              );
              const invalidSubs = subQuestionIds.filter(
                (id) => !validSubIds.includes(id),
              );

              if (invalidSubs.length > 0) {
                await t.rollback();
                return res.status(400).json({
                  message:
                    "Some sub-question IDs are not part of this question",
                  invalid: invalidSubs,
                });
              }
            }

            const subVals = resp.sub_values.map((sub) => ({
              form_id,
              form_question_id: resp.form_question_id, // parent question ID
              sub_question_id: sub.sub_question_id, // specific sub-question ID
              form_question_value_id: value.id,
              form_sub_value: sub.form_sub_value,
              remarks: sub.remarks || null,
              action_item: sub.action_item || null,
            }));

            await FormQuestionSubValue.bulkCreate(subVals, { transaction: t });
            value.dataValues.sub_values = subVals;
          }
        }

        updatedValues.push(value);
      }
    }

    await t.commit();

    return res.status(200).json({
      message: `Form entry updated as ${form_entry_status} successfully`,
      entry: existingEntry,
      answers: updatedValues,
    });
  } catch (error) {
    await t.rollback();
    console.error("Error updating form entry:", error);
    res.status(500).json({
      message: "Error updating form entry",
      error: error.message,
    });
  }
};

export const submitForApproval = async (req, res) => {
  try {
    const { form_entry_id, user_id } = req.body;

    if (!form_entry_id || !user_id) {
      return res.status(400).json({
        message: "form_entry_id and user_id are required",
      });
    }

    const formEntry = await FormEntries.findByPk(form_entry_id);
    if (!formEntry) {
      return res.status(404).json({ message: "Form entry not found" });
    }

    const user = await Users.findByPk(user_id);
    if (!user) {
      return res.status(400).json({ message: "Invalid user_id" });
    }

    let userRoles = [];

    if (Array.isArray(user.user_groups)) {
      userRoles = user.user_groups.map((r) => r.toLowerCase().trim());
    } else if (typeof user.user_groups === "string") {
      userRoles = user.user_groups
        .toLowerCase()
        .split(",")
        .map((r) => r.trim());
    }

    // Define roles
    const isRequestor = userRoles.includes("requestor");
    const isAdmin =
      userRoles.includes("qfd_admin") || userRoles.includes("all_access");

    // ❌ No permission at all
    if (!isRequestor && !isAdmin) {
      return res.status(403).json({
        message: "You don't have permission to submit this form",
      });
    }

    // Ownership check
    const isOwner = formEntry.user_id === user_id;

    // Requestor → only own form
    if (isRequestor && !isOwner) {
      return res.status(403).json({
        message: "You can only submit your own form",
      });
    }

    const currentStatus = formEntry.form_entry_status;
    if (currentStatus !== "pending") {
      return res.status(400).json({
        message: `Form cannot be submitted. Current status: '${currentStatus}'`,
      });
    }

    // ✅ Check if this is a resubmission (form was returned before)
    const isResubmission = formEntry.form_entry_return_count > 0;

    // Update status to submitted_first
    await formEntry.update({
      form_entry_status: "submitted_first",
      // ✅ NEW: Track resubmission timestamp
      ...(isResubmission && {
        form_entry_resubmitted_datetime: new Date(),
      }),
    });

    return res.status(200).json({
      message: isResubmission
        ? "Form resubmitted for approval successfully"
        : "Form submitted for approval successfully",
      formEntry: {
        id: formEntry.id,
        status: "submitted_first",
        isResubmission,
      },
    });
  } catch (error) {
    console.error("Error in submitForApproval:", error);
    res.status(500).json({
      message: "Error submitting form for approval",
      error: error.message,
    });
  }
};

export const approveFormEntry = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { form_entry_id, approver_id, action, remarks } = req.body;

    // Validate action
    if (!["approve", "reject"].includes(action)) {
      return res.status(400).json({
        message: "Invalid action. Must be 'approve' or 'reject'",
      });
    }

    // Get form entry with form details
    const formEntry = await FormEntries.findByPk(form_entry_id, {
      include: [
        {
          model: Forms,
          attributes: ["id", "form_name"],
        },
      ],
    });

    if (!formEntry) {
      return res.status(404).json({ message: "Form entry not found" });
    }

    // Get approver details
    const approver = await Users.findByPk(approver_id);
    if (!approver) {
      return res.status(400).json({ message: "Invalid approver_id" });
    }

    const approverRoles = approver.user_groups || [];
    const canApprove =
      approverRoles.includes("approver") ||
      approverRoles.includes("all_access") ||
      approverRoles.includes("qfd_admin");
    const currentStatus = formEntry.form_entry_status;

    // Determine required approval level and new status
    let newStatus;
    let approvalStage;
    let requiredLevel;
    let approverIdField;
    let approverDatetimeField;
    let approverRemarksField;

    switch (currentStatus) {
      case "submitted_first":
        requiredLevel = "first";
        newStatus = action === "approve" ? "approved_first" : "rejected";
        approvalStage = "first";
        approverIdField = "form_entry_firstapprover_id";
        approverDatetimeField = "form_entry_firstapprover_datetime";
        approverRemarksField = "form_entry_firstapprover_remarks";
        break;

      case "approved_first":
      case "submitted_second":
        requiredLevel = "second";
        newStatus = action === "approve" ? "approved_second" : "rejected";
        approvalStage = "second";
        approverIdField = "form_entry_secondapprover_id";
        approverDatetimeField = "form_entry_secondapprover_datetime";
        approverRemarksField = "form_entry_secondapprover_remarks";
        break;

      case "approved_second":
      case "submitted_third":
        requiredLevel = "third";
        newStatus = action === "approve" ? "completed" : "rejected";
        approvalStage = "third";
        approverIdField = "form_entry_thirdapprover_id";
        approverDatetimeField = "form_entry_thirdapprover_datetime";
        approverRemarksField = "form_entry_thirdapprover_remarks";
        break;

      default:
        return res.status(400).json({
          message: `Form entry is not awaiting approval. Current status: '${currentStatus}'`,
        });
    }
    if (!canApprove) {
      return res.status(403).json({
        message: "You don't have permission to approve form entries.",
      });
    }

    // ✅ all_access (IT/super admin) and qfd_admin can approve any form at
    // any level without needing an explicit FormApprovers assignment.
    const isSuperApprover =
      approverRoles.includes("all_access") || approverRoles.includes("qfd_admin");

    if (!isSuperApprover) {
      const isAssignedToForm = await FormApprovers.findOne({
        where: {
          form_id: formEntry.form_id,
          user_id: approver_id,
          approval_level: requiredLevel,
          is_active: true,
        },
      });

      if (!isAssignedToForm) {
        return res.status(403).json({
          message: `You are not assigned as a ${requiredLevel} approver for this form.`,
        });
      }
    }

    // Build update data
    const updateData = {
      form_entry_status: newStatus,
    };

    if (action === "approve") {
      updateData[approverIdField] = approver_id;
      updateData[approverDatetimeField] = new Date();
      updateData[approverRemarksField] = remarks || null;
    }

    if (action === "reject") {
      updateData.form_entry_rejector_id = approver_id;
      updateData.form_entry_rejector_datetime = new Date();
      updateData.form_entry_rejector_remarks = remarks || null;
    }

    // Update form entry
    await formEntry.update(updateData, { transaction: t });

    await t.commit();

    return res.status(200).json({
      message: `Form entry ${action}${action === "approve" ? "d" : "ed"} at ${approvalStage} approval stage`,
      formEntry: {
        id: formEntry.id,
        form_id: formEntry.form_id,
        form_name: formEntry.Form?.form_name,
        previousStatus: currentStatus,
        newStatus: newStatus,
        approvalStage: approvalStage,
      },
      approver: {
        id: approver.id,
        name: `${approver.user_firstname} ${approver.user_lastname}`,
      },
    });
  } catch (error) {
    await t.rollback();
    console.error("Error in approveFormEntry:", error);
    res.status(500).json({
      message: "Error processing approval",
      error: error.message,
    });
  }
};

export const getPendingApprovals = async (req, res) => {
  try {
    const { approver_id } = req.params;

    // 1️⃣ Validate approver exists and get their role
    const approver = await Users.findByPk(approver_id);
    if (!approver) {
      return res.status(404).json({ message: "Approver not found" });
    }

    const approverRole = approver.user_groups;

    // 2️⃣ Determine which status to query based on approver role
    let statusToQuery;
    switch (approverRole) {
      case "first_approver":
        statusToQuery = "submitted_first";
        break;
      case "second_approver":
        statusToQuery = "submitted_second";
        break;
      case "third_approver":
        statusToQuery = "submitted_third";
        break;
      default:
        return res.status(400).json({
          message: "User is not an approver",
        });
    }

    // 3️⃣ Get all forms pending this approver level's action
    const pendingForms = await FormEntries.findAll({
      where: {
        form_entry_status: statusToQuery,
        form_entry_archivestatus: 0,
      },
      include: [
        {
          model: Users,
          attributes: ["id", "user_firstname", "user_lastname", "user_email"],
        },
        {
          model: Forms,
          attributes: ["id", "form_name"],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    return res.status(200).json({
      approver: {
        id: approver.id,
        name: `${approver.user_firstname} ${approver.user_lastname}`,
        email: approver.user_email,
        role: approverRole,
      },
      pendingCount: pendingForms.length,
      forms: pendingForms,
    });
  } catch (error) {
    console.error("Error in getPendingApprovals:", error);
    res.status(500).json({
      message: "Error fetching pending approvals",
      error: error.message,
    });
  }
};

// Get approval history for a form entry
export const getApprovalHistory = async (req, res) => {
  try {
    const { id } = req.params;

    const formEntry = await FormEntries.findByPk(id, {
      include: [
        {
          model: Users,
          as: "User",
          attributes: ["id", "user_firstname", "user_lastname", "user_email"],
        },
        {
          model: Users,
          as: "firstApprover",
          attributes: ["id", "user_firstname", "user_lastname", "user_email"],
        },
        {
          model: Users,
          as: "secondApprover",
          attributes: ["id", "user_firstname", "user_lastname", "user_email"],
        },
        {
          model: Users,
          as: "thirdApprover",
          attributes: ["id", "user_firstname", "user_lastname", "user_email"],
        },
        {
          model: Users,
          as: "rejector",
          attributes: ["id", "user_firstname", "user_lastname", "user_email"],
        },
        {
          model: Users,
          as: "returner",
          attributes: ["id", "user_firstname", "user_lastname", "user_email"],
        },
        {
          model: Forms,
          attributes: ["id", "form_name"],
        },
      ],
    });

    if (!formEntry) {
      return res.status(404).json({ message: "Form entry not found" });
    }

    const timeline = [];

    // 1. Form Submitted
    timeline.push({
      action: "submitted",
      actionLabel: "Form Submitted",
      user: formEntry.User
        ? {
            id: formEntry.User.id,
            name: `${formEntry.User.user_firstname} ${formEntry.User.user_lastname}`,
            email: formEntry.User.user_email,
          }
        : null,
      datetime: formEntry.createdAt,
      remarks: null,
    });

    // 2. First Approval
    if (formEntry.form_entry_firstapprover_id) {
      timeline.push({
        action: "approved_first",
        actionLabel: "1st Approval - Approved",
        user: formEntry.firstApprover
          ? {
              id: formEntry.firstApprover.id,
              name: `${formEntry.firstApprover.user_firstname} ${formEntry.firstApprover.user_lastname}`,
              email: formEntry.firstApprover.user_email,
            }
          : null,
        datetime: formEntry.form_entry_firstapprover_datetime,
        remarks: formEntry.form_entry_firstapprover_remarks,
      });
    }

    // 3. Second Approval
    if (formEntry.form_entry_secondapprover_id) {
      timeline.push({
        action: "approved_second",
        actionLabel: "2nd Approval - Approved",
        user: formEntry.secondApprover
          ? {
              id: formEntry.secondApprover.id,
              name: `${formEntry.secondApprover.user_firstname} ${formEntry.secondApprover.user_lastname}`,
              email: formEntry.secondApprover.user_email,
            }
          : null,
        datetime: formEntry.form_entry_secondapprover_datetime,
        remarks: formEntry.form_entry_secondapprover_remarks,
      });
    }

    // 4. Third Approval
    if (formEntry.form_entry_thirdapprover_id) {
      timeline.push({
        action: "approved_third",
        actionLabel: "3rd Approval - Approved",
        user: formEntry.thirdApprover
          ? {
              id: formEntry.thirdApprover.id,
              name: `${formEntry.thirdApprover.user_firstname} ${formEntry.thirdApprover.user_lastname}`,
              email: formEntry.thirdApprover.user_email,
            }
          : null,
        datetime: formEntry.form_entry_thirdapprover_datetime,
        remarks: formEntry.form_entry_thirdapprover_remarks,
      });
    }

    // 5. Return (if any)
    if (formEntry.form_entry_returner_id) {
      const returnLevelText =
        formEntry.form_entry_last_return_level === "first"
          ? "1st"
          : formEntry.form_entry_last_return_level === "second"
            ? "2nd"
            : "3rd";

      timeline.push({
        action: "returned",
        actionLabel: `Form Returned from ${returnLevelText} Approval`,
        user: formEntry.returner
          ? {
              id: formEntry.returner.id,
              name: `${formEntry.returner.user_firstname} ${formEntry.returner.user_lastname}`,
              email: formEntry.returner.user_email,
            }
          : null,
        datetime: formEntry.form_entry_returner_datetime,
        remarks: formEntry.form_entry_returner_remarks,
      });
    }

    // 6. ✅ NEW: Resubmission (if form was returned and resubmitted)
    if (formEntry.form_entry_resubmitted_datetime) {
      timeline.push({
        action: "resubmitted",
        actionLabel: "Form Resubmitted",
        user: formEntry.User
          ? {
              id: formEntry.User.id,
              name: `${formEntry.User.user_firstname} ${formEntry.User.user_lastname}`,
              email: formEntry.User.user_email,
            }
          : null,
        datetime: formEntry.form_entry_resubmitted_datetime,
        remarks: null,
      });
    }

    // 7. Rejection (if any)
    if (formEntry.form_entry_rejector_id) {
      timeline.push({
        action: "rejected",
        actionLabel: "Form Rejected",
        user: formEntry.rejector
          ? {
              id: formEntry.rejector.id,
              name: `${formEntry.rejector.user_firstname} ${formEntry.rejector.user_lastname}`,
              email: formEntry.rejector.user_email,
            }
          : null,
        datetime: formEntry.form_entry_rejector_datetime,
        remarks: formEntry.form_entry_rejector_remarks,
      });
    }

    // 8. Completed
    if (formEntry.form_entry_status === "completed") {
      timeline.push({
        action: "completed",
        actionLabel: "Form Completed",
        user: null,
        datetime: formEntry.updatedAt,
        remarks: null,
      });
    }

    timeline.sort((a, b) => new Date(a.datetime) - new Date(b.datetime));

    return res.status(200).json({
      formEntry: {
        id: formEntry.id,
        form_name: formEntry.Form?.form_name,
        status: formEntry.form_entry_status,
        site: formEntry.form_entry_site,
        area: formEntry.form_entry_area,
        date: formEntry.form_entry_date,
        returnCount: formEntry.form_entry_return_count,
      },
      timeline,
    });
  } catch (error) {
    console.error("Error in getApprovalHistory:", error);
    res.status(500).json({
      message: "Error fetching approval history",
      error: error.message,
    });
  }
};

// Return form entry to requestor for corrections
export const returnFormEntry = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { form_entry_id, returner_id, remarks } = req.body;

    // Validate inputs
    if (!form_entry_id || !returner_id) {
      return res.status(400).json({
        message: "form_entry_id and returner_id are required",
      });
    }

    // Get form entry with form details
    const formEntry = await FormEntries.findByPk(form_entry_id, {
      include: [
        {
          model: Forms,
          attributes: ["id", "form_name"],
        },
      ],
    });

    if (!formEntry) {
      return res.status(404).json({ message: "Form entry not found" });
    }

    // Get returner details
    const returner = await Users.findByPk(returner_id);
    if (!returner) {
      return res.status(400).json({ message: "Invalid returner_id" });
    }

    const returnerRoles = returner.user_groups || [];
    const canReturn =
      returnerRoles.includes("approver") ||
      returnerRoles.includes("all_access") ||
      returnerRoles.includes("qfd_admin");
    const currentStatus = formEntry.form_entry_status;

    if (!canReturn) {
      return res.status(403).json({
        message: "You don't have permission to return form entries.",
      });
    }

    // ✅ Check if form is in a returnable state
    const returnableStatuses = [
      "submitted_first",
      "approved_first",
      "submitted_second",
      "approved_second",
      "submitted_third",
    ];

    if (!returnableStatuses.includes(currentStatus)) {
      return res.status(400).json({
        message: `Form cannot be returned. Current status: '${currentStatus}'`,
      });
    }

    // Determine which approval level is returning
    let returnLevel;
    let requiredLevel;

    switch (currentStatus) {
      case "submitted_first":
        requiredLevel = "first";
        returnLevel = "first";
        break;

      case "approved_first":
      case "submitted_second":
        requiredLevel = "second";
        returnLevel = "second";
        break;

      case "approved_second":
      case "submitted_third":
        requiredLevel = "third";
        returnLevel = "third";
        break;

      default:
        return res.status(400).json({
          message: "Invalid status for return",
        });
    }

    // ✅ all_access (IT/super admin) and qfd_admin can return any form at any
    // level without needing an explicit FormApprovers assignment.
    const isSuperApprover =
      returnerRoles.includes("all_access") || returnerRoles.includes("qfd_admin");

    // ✅ Authorization Check 2: Is user assigned to approve THIS form at THIS level?
    const isAssignedToForm =
      isSuperApprover ||
      (await FormApprovers.findOne({
        where: {
          form_id: formEntry.form_id,
          user_id: returner_id,
          approval_level: requiredLevel,
          is_active: true,
        },
      }));

    if (!isAssignedToForm) {
      return res.status(403).json({
        message: `You are not assigned as a ${requiredLevel} approver for this form.`,
      });
    }

    // ✅ Update form entry - Return to requestor for correction
    const updateData = {
      form_entry_status: "returned",
      form_entry_returner_id: returner_id,
      form_entry_returner_datetime: new Date(),
      form_entry_returner_remarks: remarks || null,
      form_entry_return_count: formEntry.form_entry_return_count + 1,
      form_entry_last_return_level: returnLevel,
    };

    // ✅ IMPORTANT CHANGE: DON'T clear approval data - keep history intact
    // The approval data stays so we can see full history
    // When resubmitted, new approval cycle will overwrite these fields

    // Update form entry
    await formEntry.update(updateData, { transaction: t });

    await t.commit();

    return res.status(200).json({
      message: `Form entry returned successfully. Requestor can now edit and resubmit.`,
      formEntry: {
        id: formEntry.id,
        form_id: formEntry.form_id,
        form_name: formEntry.Form?.form_name,
        previousStatus: currentStatus,
        newStatus: "returned",
        returnLevel: returnLevel,
        returnCount: formEntry.form_entry_return_count + 1,
      },
      returner: {
        id: returner.id,
        name: `${returner.user_firstname} ${returner.user_lastname}`,
      },
    });
  } catch (error) {
    await t.rollback();
    console.error("Error in returnFormEntry:", error);
    res.status(500).json({
      message: "Error returning form entry",
      error: error.message,
    });
  }
};
