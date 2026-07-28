import FormApprovers from "../Models/FormApprovers.js";
import Users from "../Models/Users.js";
import Forms from "../Models/Forms.js";
import sequelize from "../utilities/db.js";

export const getFormApproversByUser = async (req, res) => {
  try {
    const { userId } = req.params;

    // 1️⃣ Verify user exists
    const user = await Users.findByPk(userId, {
      attributes: ["id", "user_firstname", "user_lastname", "user_groups"],
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // 2️⃣ Get all forms
    const allForms = await Forms.findAll({
      attributes: ["id", "form_name", "form_description"],
      order: [["form_name", "ASC"]],
    });

    // 3️⃣ Get user's current approval assignments
    const userApprovals = await FormApprovers.findAll({
      where: {
        user_id: userId,
        is_active: true,
      },
      attributes: ["form_id", "approval_level"],
    });

    // 4️⃣ Create a map of form assignments
    // Structure: { form_id: { first: true, second: false, third: true } }
    const assignmentMap = {};
    userApprovals.forEach((approval) => {
      if (!assignmentMap[approval.form_id]) {
        assignmentMap[approval.form_id] = {
          first: false,
          second: false,
          third: false,
        };
      }
      assignmentMap[approval.form_id][approval.approval_level] = true;
    });

    // 5️⃣ Build response with all forms and their assignment status
    const formsWithAssignments = allForms.map((form) => ({
      form_id: form.id,
      form_name: form.form_name,
      form_description: form.form_description,
      assignments: assignmentMap[form.id] || {
        first: false,
        second: false,
        third: false,
      },
    }));

    return res.status(200).json({
      user: {
        id: user.id,
        name: `${user.user_firstname} ${user.user_lastname}`,
        roles: user.user_groups,
      },
      forms: formsWithAssignments,
    });
  } catch (error) {
    console.error("Error in getFormApproversByUser:", error);
    res.status(500).json({
      message: "Error fetching user's form approvals",
      error: error.message,
    });
  }
};

export const updateUserFormApprovals = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { userId } = req.params;
    const { assignments } = req.body;
    // assignments format: [{ form_id: 1, levels: ['first', 'second'] }, { form_id: 2, levels: ['third'] }]

    // 1️⃣ Verify user exists
    const user = await Users.findByPk(userId, {
      attributes: ["id", "user_firstname", "user_lastname", "user_groups"],
    });

    if (!user) {
      await t.rollback();
      return res.status(404).json({ message: "User not found" });
    }

    // 2️⃣ Validate assignments format
    if (!Array.isArray(assignments)) {
      await t.rollback();
      return res.status(400).json({
        message: "Assignments must be an array",
      });
    }

    // 3️⃣ Validate that user has the required roles for assignments
    const userRoles = user.user_groups || [];
    const validLevels = ["first", "second", "third"];

    const canApprove =
      userRoles.includes("approver") ||
      userRoles.includes("all_access") ||
      userRoles.includes("qfd_admin");

    if (assignments.length > 0 && !canApprove) {
      await t.rollback();
      return res.status(400).json({
        message:
          "User must have 'approver', 'all_access', or 'qfd_admin' role to be assigned as an approver.",
      });
    }

    for (const assignment of assignments) {
      if (!assignment.form_id || !Array.isArray(assignment.levels)) {
        await t.rollback();
        return res.status(400).json({
          message: "Each assignment must have form_id and levels array",
        });
      }

      // Validate approval levels are valid
      for (const level of assignment.levels) {
        if (!validLevels.includes(level)) {
          await t.rollback();
          return res.status(400).json({
            message: `Invalid approval level: ${level}`,
          });
        }
      }

      // Verify form exists
      const formExists = await Forms.findByPk(assignment.form_id);
      if (!formExists) {
        await t.rollback();
        return res.status(404).json({
          message: `Form with ID ${assignment.form_id} not found`,
        });
      }
    }

    // 4️⃣ Delete all existing assignments for this user
    await FormApprovers.destroy({
      where: { user_id: userId },
      transaction: t,
    });

    // 5️⃣ Create new assignments
    const newAssignments = [];
    for (const assignment of assignments) {
      for (const level of assignment.levels) {
        newAssignments.push({
          form_id: assignment.form_id,
          user_id: userId,
          approval_level: level,
          is_active: true,
        });
      }
    }

    // Only create if there are assignments
    if (newAssignments.length > 0) {
      await FormApprovers.bulkCreate(newAssignments, { transaction: t });
    }

    await t.commit();

    return res.status(200).json({
      message: "User form approvals updated successfully",
      assignmentsCount: newAssignments.length,
    });
  } catch (error) {
    await t.rollback();
    console.error("Error in updateUserFormApprovals:", error);
    res.status(500).json({
      message: "Error updating user's form approvals",
      error: error.message,
    });
  }
};

export const getApproversByForm = async (req, res) => {
  try {
    const { formId } = req.params;

    // 1️⃣ Verify form exists
    const form = await Forms.findByPk(formId, {
      attributes: ["id", "form_name", "form_description"],
    });

    if (!form) {
      return res.status(404).json({ message: "Form not found" });
    }

    // 2️⃣ Get all approvers for this form
    const approvers = await FormApprovers.findAll({
      where: {
        form_id: formId,
        is_active: true,
      },
      include: [
        {
          model: Users,
          as: "user",
          attributes: [
            "id",
            "user_firstname",
            "user_lastname",
            "user_email",
            "user_groups",
          ],
        },
      ],
      order: [
        ["approval_level", "ASC"], // first, second, third
        [{ model: Users, as: "user" }, "user_firstname", "ASC"],
      ],
    });

    // 3️⃣ Group approvers by level
    const approversByLevel = {
      first: [],
      second: [],
      third: [],
    };

    approvers.forEach((approver) => {
      const level = approver.approval_level;
      approversByLevel[level].push({
        id: approver.user.id,
        name: `${approver.user.user_firstname} ${approver.user.user_lastname}`,
        email: approver.user.user_email,
        roles: approver.user.user_groups,
      });
    });

    return res.status(200).json({
      form: {
        id: form.id,
        name: form.form_name,
        description: form.form_description,
      },
      approvers: approversByLevel,
    });
  } catch (error) {
    console.error("Error in getApproversByForm:", error);
    res.status(500).json({
      message: "Error fetching form approvers",
      error: error.message,
    });
  }
};

export const updateFormApprovers = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { formId } = req.params;
    const { assignments } = req.body;
    // assignments format: { first: [userId, ...], second: [...], third: [...] }
    // Arrays (not single ids) because the schema allows more than one
    // approver per level per form.

    const form = await Forms.findByPk(formId);
    if (!form) {
      await t.rollback();
      return res.status(404).json({ message: "Form not found" });
    }

    if (!assignments || typeof assignments !== "object") {
      await t.rollback();
      return res.status(400).json({ message: "assignments object is required" });
    }

    const validLevels = ["first", "second", "third"];

    for (const level of validLevels) {
      const userIds = assignments[level];
      if (userIds === undefined) continue;

      if (!Array.isArray(userIds)) {
        await t.rollback();
        return res.status(400).json({
          message: `assignments.${level} must be an array of user IDs`,
        });
      }

      for (const userId of userIds) {
        const user = await Users.findByPk(userId);
        const roles = user?.user_groups || [];
        const canApprove =
          roles.includes("approver") ||
          roles.includes("all_access") ||
          roles.includes("qfd_admin");

        if (!user || !canApprove) {
          await t.rollback();
          return res.status(400).json({
            message: `User ${userId} is not eligible to be an approver.`,
          });
        }
      }
    }

    // Replace only this form's existing assignments
    await FormApprovers.destroy({
      where: { form_id: formId },
      transaction: t,
    });

    const newAssignments = [];
    for (const level of validLevels) {
      for (const userId of assignments[level] || []) {
        newAssignments.push({
          form_id: formId,
          user_id: userId,
          approval_level: level,
          is_active: true,
        });
      }
    }

    if (newAssignments.length > 0) {
      await FormApprovers.bulkCreate(newAssignments, { transaction: t });
    }

    await t.commit();

    return res.status(200).json({
      message: "Form approvers updated successfully",
      assignmentsCount: newAssignments.length,
    });
  } catch (error) {
    await t.rollback();
    console.error("Error in updateFormApprovers:", error);
    res.status(500).json({
      message: "Error updating form's approvers",
      error: error.message,
    });
  }
};

export const checkUserCanApprove = async (req, res) => {
  try {
    const { formEntryId, userId } = req.params;

    // This will be implemented when we integrate with form entry approval
    // For now, return a placeholder
    return res.status(200).json({
      message: "This endpoint will be implemented in approval logic phase",
      canApprove: false,
    });
  } catch (error) {
    console.error("Error in checkUserCanApprove:", error);
    res.status(500).json({
      message: "Error checking approval permission",
      error: error.message,
    });
  }
};
