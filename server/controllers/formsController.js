import Form from "../Models/Forms.js";
import FormSection from "../Models/FormSection.js";
import Questions from "../Models/Questions.js";
import SubQuestion from "../Models/SubQuestion.js";
import { Op } from "sequelize";
import sequelize from "../utilities/db.js";

// Get all forms
export const getForms = async (req, res) => {
  try {
    const forms = await Form.findAll();
    res.status(200).json(forms);
  } catch (error) {
    res.status(500).json({ message: "Error fetching forms", error });
  }
};

// Get form by ID (with sections, questions, and sub-questions)
export const getFormById = async (req, res) => {
  try {
    const form = await Form.findByPk(req.params.id, {
      include: [
        {
          model: FormSection,
          as: "sections",
          where: { form_section_archivestatus: 0 }, // Only non-archived sections
          required: false, // Use LEFT JOIN so form still returns even if no sections
          include: [
            {
              model: Questions,
              as: "questions",
              where: { form_questions_archivestatus: 0 }, // Only non-archived questions
              required: false,
              include: [
                {
                  model: SubQuestion,
                  as: "subQuestions",
                  where: { sub_question_archivestatus: 0 }, // Only non-archived subquestions
                  required: false,
                },
              ],
            },
          ],
        },
      ],
    });

    if (!form) {
      return res.status(404).json({ message: "Form not found" });
    }

    res.status(200).json(form);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching form", error: error.message });
  }
};

// Create a new Form
export const createForm = async (req, res) => {
  try {
    const { form_name, form_description } = req.body;
    const newForm = await Form.create({ form_name, form_description });

    res
      .status(201)
      .json({ message: "Form created successfully", form: newForm });
  } catch (error) {
    res.status(500).json({ message: "Error creating form", error });
  }
};

// Update an existing Form
export const updateForm = async (req, res) => {
  try {
    const { form_name, form_description } = req.body;
    const form = await Form.findByPk(req.params.id);
    if (!form) return res.status(404).json({ message: "Form not found" });

    await form.update({ form_name, form_description });
    res.status(200).json({ message: "Form updated successfully", form });
  } catch (error) {
    res.status(500).json({ message: "Error updating form", error });
  }
};

// Delete a Form
export const deleteForm = async (req, res) => {
  try {
    const form = await Form.findByPk(req.params.id);
    if (!form) return res.status(404).json({ message: "Form not found" });

    await form.destroy();
    res.status(200).json({ message: "Form deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error deleting form", error });
  }
};

// Get Forms with Pagination and Filtering
export const formsPagination = async (req, res) => {
  try {
    // Pagination Params
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 10;
    const offset = (page - 1) * pageSize;

    // Filter Params
    const { id, form_name, from, to } = req.query;
    const whereCondition = {};

    if (id) {
      whereCondition.id = id;
    }

    if (form_name) {
      whereCondition.form_name = { [Op.like]: `%${form_name}%` };
    }

    if (from && to) {
      whereCondition.createdAt = { [Op.between]: [from, to] };
    }

    // Fetch paginated data
    const { rows: forms, count } = await Form.findAndCountAll({
      where: whereCondition,
      order: [["id", "ASC"]],
      limit: pageSize,
      offset,
    });

    res.status(200).json({
      message: "Forms fetched successfully",
      total: count,
      totalPages: Math.ceil(count / pageSize),
      currentPage: page,
      pageSize,
      forms,
    });
  } catch (error) {
    res.status(500).json({ message: "Error fetching paginated forms", error });
  }
};

// Create Forms Builder - Create/Update Form, Sections, Questions, SubQuestions
export const submitFormBuilder = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const {
      form_id,
      form_name,
      form_description,
      form_archivestatus,
      form_effective_date,
      form_revision_number,
      sections = [],
    } = req.body;

    let currentFormId;

    if (form_id) {
      await Form.update(
        {
          form_name,
          form_description,
          form_archivestatus: form_archivestatus ?? 0,
          form_effective_date: form_effective_date || null,
          form_revision_number: form_revision_number || null,
        },
        { where: { id: form_id }, transaction: t },
      );
      currentFormId = form_id;
    } else {
      const newForm = await Form.create(
        {
          form_name,
          form_description,
          form_archivestatus: form_archivestatus ?? 0,
          form_effective_date: form_effective_date || null,
          form_revision_number: form_revision_number || null,
        },
        { transaction: t },
      );
      currentFormId = newForm.id;
    }

    for (const section of sections) {
      const {
        form_section_id,
        form_section_name,
        form_section_description,
        form_section_archivestatus,
        delete: deleteSection = false,
        questions = [],
      } = section;

      let currentSectionId;

      if (deleteSection && form_section_id) {
        await FormSection.update(
          { form_section_archivestatus: 1 },
          { where: { form_section_id }, transaction: t },
        );
        await Questions.update(
          { form_questions_archivestatus: 1 },
          { where: { form_section_id }, transaction: t },
        );
        continue;
      }

      if (form_section_id) {
        await FormSection.update(
          {
            form_section_name,
            form_section_description,
            form_section_archivestatus: form_section_archivestatus ?? 0,
          },
          { where: { form_section_id }, transaction: t },
        );
        currentSectionId = form_section_id;
      } else {
        const newSection = await FormSection.create(
          {
            form_id: currentFormId,
            form_section_name,
            form_section_description,
            form_section_archivestatus: form_section_archivestatus ?? 0,
          },
          { transaction: t },
        );
        currentSectionId = newSection.form_section_id;
      }

      for (const question of questions) {
        const {
          form_question_id,
          form_questions,
          question_type,
          required,
          choices,
          form_questions_archivestatus,
          delete: deleteQuestion = false,
          subQuestions = [],
        } = question;

        let currentQuestionId;

        if (deleteQuestion && form_question_id) {
          await Questions.update(
            { form_questions_archivestatus: 1 },
            { where: { id: form_question_id }, transaction: t },
          );
          continue;
        }

        if (form_question_id) {
          await Questions.update(
            {
              form_questions,
              question_type,
              required,
              choices: question_type === "dropdown" ? (choices ?? []) : [],
              form_questions_archivestatus: form_questions_archivestatus ?? 0,
            },
            { where: { id: form_question_id }, transaction: t },
          );
          currentQuestionId = form_question_id;
        } else {
          const newQuestion = await Questions.create(
            {
              form_id: currentFormId,
              form_section_id: currentSectionId,
              form_questions,
              question_type,
              required,
              choices: question_type === "dropdown" ? (choices ?? []) : [],
              form_questions_archivestatus: form_questions_archivestatus ?? 0,
            },
            { transaction: t },
          );
          currentQuestionId = newQuestion.id;
        }

        for (const subQ of subQuestions) {
          const {
            sub_question_id,
            sub_questions,
            question_type,
            required: subRequired,
            choices,
            sub_question_archivestatus,
            delete: deleteSubQ = false,
          } = subQ;

          if (deleteSubQ && sub_question_id) {
            await SubQuestion.update(
              { sub_question_archivestatus: 1 },
              { where: { sub_question_id }, transaction: t },
            );
            continue;
          }

          if (sub_question_id) {
            await SubQuestion.update(
              {
                sub_questions,
                question_type,
                required: subRequired,
                choices: question_type === "dropdown" ? (choices ?? []) : [],
                sub_question_archivestatus: sub_question_archivestatus ?? 0,
              },
              { where: { sub_question_id }, transaction: t },
            );
          } else {
            await SubQuestion.create(
              {
                question_id: currentQuestionId,
                sub_questions,
                question_type,
                required: subRequired,
                choices: question_type === "dropdown" ? (choices ?? []) : [],
                sub_question_archivestatus: sub_question_archivestatus ?? 0,
              },
              { transaction: t },
            );
          }
        }
      }
    }

    await t.commit();
    res.status(200).json({
      message:
        "Form, sections, questions, and sub-questions submitted successfully.",
      form_id: currentFormId,
    });
  } catch (error) {
    await t.rollback();
    console.error("Submit Error:", error);
    res.status(500).json({
      message: "Error submitting form data",
      error: error.message,
    });
  }
};

// Update Form Builder - Update Form, Sections, Questions, SubQuestions
export const updateFormBuilder = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const {
      form_id,
      form_name,
      form_description,
      form_archivestatus,
      sections = [],
    } = req.body;

    if (!form_id) {
      return res
        .status(400)
        .json({ message: "Form ID is required for update" });
    }

    await Form.update(
      {
        form_name,
        form_description,
        form_archivestatus: form_archivestatus ?? 0,
      },
      { where: { id: form_id }, transaction: t },
    );

    const existingSections = await FormSection.findAll({
      where: { form_id },
      include: [
        {
          model: Questions,
          as: "questions",
          include: [{ model: SubQuestion, as: "subQuestions" }],
        },
      ],
      transaction: t,
    });

    const requestSectionIds = sections
      .filter((s) => s.form_section_id)
      .map((s) => s.form_section_id);

    for (const section of existingSections) {
      if (!requestSectionIds.includes(section.form_section_id)) {
        await FormSection.update(
          { form_section_archivestatus: 1 },
          {
            where: { form_section_id: section.form_section_id },
            transaction: t,
          },
        );
        await Questions.update(
          { form_questions_archivestatus: 1 },
          {
            where: { form_section_id: section.form_section_id },
            transaction: t,
          },
        );
      }
    }

    for (const section of sections) {
      const {
        form_section_id,
        form_section_name,
        form_section_description,
        form_section_archivestatus,
        questions = [],
      } = section;

      let currentSectionId;

      if (form_section_id) {
        await FormSection.update(
          {
            form_section_name,
            form_section_description,
            form_section_archivestatus: form_section_archivestatus ?? 0,
          },
          { where: { form_section_id }, transaction: t },
        );
        currentSectionId = form_section_id;
      } else {
        const newSection = await FormSection.create(
          {
            form_id,
            form_section_name,
            form_section_description,
            form_section_archivestatus: form_section_archivestatus ?? 0,
          },
          { transaction: t },
        );
        currentSectionId = newSection.form_section_id;
      }

      const existingQuestions =
        existingSections.find((s) => s.form_section_id === currentSectionId)
          ?.questions || [];

      const requestQuestionIds = questions
        .filter((q) => q.form_question_id)
        .map((q) => q.form_question_id);

      for (const q of existingQuestions) {
        if (!requestQuestionIds.includes(q.id)) {
          await Questions.update(
            { form_questions_archivestatus: 1 },
            { where: { id: q.id }, transaction: t },
          );
        }
      }

      for (const question of questions) {
        const {
          form_question_id,
          form_questions,
          question_type,
          required,
          choices, // ✅ added
          form_questions_archivestatus,
          subQuestions = [],
        } = question;

        let currentQuestionId;

        if (form_question_id) {
          await Questions.update(
            {
              form_questions,
              question_type,
              required,
              choices: question_type === "dropdown" ? (choices ?? []) : [], // ✅ added
              form_questions_archivestatus: form_questions_archivestatus ?? 0,
            },
            { where: { id: form_question_id }, transaction: t },
          );
          currentQuestionId = form_question_id;
        } else {
          const newQuestion = await Questions.create(
            {
              form_id,
              form_section_id: currentSectionId,
              form_questions,
              question_type,
              required,
              choices: question_type === "dropdown" ? (choices ?? []) : [], // ✅ added
              form_questions_archivestatus: form_questions_archivestatus ?? 0,
            },
            { transaction: t },
          );
          currentQuestionId = newQuestion.id;
        }

        const existingSubQs =
          existingQuestions.find((q) => q.id === currentQuestionId)
            ?.subQuestions || [];

        const requestSubQIds = subQuestions
          .filter((sq) => sq.sub_question_id)
          .map((sq) => sq.sub_question_id);

        for (const sq of existingSubQs) {
          if (!requestSubQIds.includes(sq.sub_question_id)) {
            await SubQuestion.update(
              { sub_question_archivestatus: 1 },
              {
                where: { sub_question_id: sq.sub_question_id },
                transaction: t,
              },
            );
          }
        }

        for (const subQ of subQuestions) {
          const {
            sub_question_id,
            sub_questions,
            question_type,
            required: subRequired,
            choices, // ✅ added
            sub_question_archivestatus,
          } = subQ;

          if (sub_question_id) {
            await SubQuestion.update(
              {
                sub_questions,
                question_type,
                required: subRequired,
                choices: question_type === "dropdown" ? (choices ?? []) : [], // ✅ added
                sub_question_archivestatus: sub_question_archivestatus ?? 0,
              },
              { where: { sub_question_id }, transaction: t },
            );
          } else {
            await SubQuestion.create(
              {
                question_id: currentQuestionId,
                sub_questions,
                question_type,
                required: subRequired,
                choices: question_type === "dropdown" ? (choices ?? []) : [], // ✅ added
                sub_question_archivestatus: sub_question_archivestatus ?? 0,
              },
              { transaction: t },
            );
          }
        }
      }
    }

    await t.commit();
    res.status(200).json({
      message: "Form updated successfully.",
      form_id,
    });
  } catch (error) {
    await t.rollback();
    console.error("Update Error:", error);
    res.status(500).json({
      message: "Error updating form data",
      error: error.message,
    });
  }
};
