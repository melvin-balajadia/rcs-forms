import Form from "../Models/Forms.js";
import FormSection from "../Models/FormSection.js";
import Questions from "../Models/Questions.js";
import SubQuestion from "../Models/SubQuestion.js";
import { Op } from "sequelize";
import sequelize from "../utilities/db.js";

// Get all forms (archived forms are hidden)
export const getForms = async (req, res) => {
  try {
    const forms = await Form.findAll({ where: { form_archivestatus: 0 } });
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
// Archive a form: hidden from form lists and can't receive new entries, but
// nothing is deleted. Its existing entries stay viewable.
export const archiveForm = async (req, res) => {
  try {
    const form = await Form.findOne({
      where: { id: req.params.id, form_archivestatus: 0 },
    });
    if (!form) return res.status(404).json({ message: "Form not found" });

    await form.update({ form_archivestatus: 1 });
    res.status(200).json({ message: "Form archived successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error archiving form", error });
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
    const whereCondition = { form_archivestatus: 0 }; // Only active forms

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

// Ids of the sections, questions and sub-questions that belong to a form. The
// builders skip any id in the request that isn't in these sets, so a request
// for one form can never update or archive another form's rows.
const loadFormRowIds = async (formId, transaction) => {
  const sections = await FormSection.findAll({
    where: { form_id: formId },
    attributes: ["form_section_id"],
    transaction,
  });
  const questions = await Questions.findAll({
    where: { form_id: formId },
    attributes: ["id"],
    transaction,
  });
  const subQuestions = questions.length
    ? await SubQuestion.findAll({
        where: { question_id: questions.map((q) => q.id) },
        attributes: ["sub_question_id"],
        transaction,
      })
    : [];
  return {
    sections: new Set(sections.map((r) => r.form_section_id)),
    questions: new Set(questions.map((r) => r.id)),
    subQuestions: new Set(subQuestions.map((r) => r.sub_question_id)),
  };
};

// Create Forms Builder - Create/Update Form, Sections, Questions, SubQuestions
export const submitFormBuilder = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const {
      form_id,
      form_name,
      form_description,
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
          form_archivestatus: 0,
          form_effective_date: form_effective_date || null,
          form_revision_number: form_revision_number || null,
        },
        { transaction: t },
      );
      currentFormId = newForm.id;
    }

    const owned = await loadFormRowIds(currentFormId, t);

    for (const section of sections) {
      const {
        form_section_id,
        form_section_name,
        form_section_description,
        form_section_archivestatus,
        delete: deleteSection = false,
        questions = [],
      } = section;

      // Not a section of this form: ignore it and everything under it
      if (form_section_id && !owned.sections.has(Number(form_section_id)))
        continue;

      let currentSectionId;

      if (deleteSection && form_section_id) {
        await FormSection.update(
          { form_section_archivestatus: 1 },
          { where: { form_section_id, form_id: currentFormId }, transaction: t },
        );
        await Questions.update(
          { form_questions_archivestatus: 1 },
          { where: { form_section_id, form_id: currentFormId }, transaction: t },
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
          { where: { form_section_id, form_id: currentFormId }, transaction: t },
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

        // Not a question of this form: ignore it and its sub-questions
        if (form_question_id && !owned.questions.has(Number(form_question_id)))
          continue;

        let currentQuestionId;

        if (deleteQuestion && form_question_id) {
          await Questions.update(
            { form_questions_archivestatus: 1 },
            { where: { id: form_question_id, form_id: currentFormId }, transaction: t },
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
            { where: { id: form_question_id, form_id: currentFormId }, transaction: t },
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

          // Not a sub-question of this form: ignore it
          if (sub_question_id && !owned.subQuestions.has(Number(sub_question_id)))
            continue;

          if (deleteSubQ && sub_question_id) {
            await SubQuestion.update(
              { sub_question_archivestatus: 1 },
              {
                where: { sub_question_id, question_id: currentQuestionId },
                transaction: t,
              },
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
              {
                where: { sub_question_id, question_id: currentQuestionId },
                transaction: t,
              },
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
    if (!t.finished) await t.rollback();
    console.error("Submit Error:", error);
    res.status(500).json({
      message: "Error submitting form data",
      error: error.message,
    });
  } finally {
    // Early returns above skip rollback; never leave a transaction open
    if (!t.finished) await t.rollback();
  }
};

// Update Form Builder - Update Form, Sections, Questions, SubQuestions
export const updateFormBuilder = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const {
      form_name,
      form_description,
      sections = [],
    } = req.body;
    // The form is the one in the URL, never a body-supplied form_id
    const form_id = Number(req.params.id);

    if (!form_id) {
      return res
        .status(400)
        .json({ message: "Form ID is required for update" });
    }

    await Form.update(
      { form_name, form_description },
      { where: { id: form_id }, transaction: t },
    );

    const owned = await loadFormRowIds(form_id, t);

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

      // Not a section of this form: ignore it and everything under it
      if (form_section_id && !owned.sections.has(Number(form_section_id)))
        continue;

      let currentSectionId;

      if (form_section_id) {
        await FormSection.update(
          {
            form_section_name,
            form_section_description,
            form_section_archivestatus: form_section_archivestatus ?? 0,
          },
          { where: { form_section_id, form_id }, transaction: t },
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

        // Not a question of this form: ignore it and its sub-questions
        if (form_question_id && !owned.questions.has(Number(form_question_id)))
          continue;

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
            { where: { id: form_question_id, form_id }, transaction: t },
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

          // Not a sub-question of this form: ignore it
          if (sub_question_id && !owned.subQuestions.has(Number(sub_question_id)))
            continue;

          if (sub_question_id) {
            await SubQuestion.update(
              {
                sub_questions,
                question_type,
                required: subRequired,
                choices: question_type === "dropdown" ? (choices ?? []) : [], // ✅ added
                sub_question_archivestatus: sub_question_archivestatus ?? 0,
              },
              {
                where: { sub_question_id, question_id: currentQuestionId },
                transaction: t,
              },
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
    if (!t.finished) await t.rollback();
    console.error("Update Error:", error);
    res.status(500).json({
      message: "Error updating form data",
      error: error.message,
    });
  } finally {
    // Early returns above skip rollback; never leave a transaction open
    if (!t.finished) await t.rollback();
  }
};
