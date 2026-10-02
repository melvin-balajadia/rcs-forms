import sequelize from "../../utilities/db.js";
import Form from "../../Models/Forms.js";
import FormSection from "../../Models/FormSection.js";
import Questions from "../../Models/Questions.js";
import SubQuestion from "../../Models/SubQuestion.js";
import { fail } from "../../utilities/http.js";

// Form builder: saves a form's sections → questions → sub-questions tree.
//
// Both endpoints use the same walker:
//   POST /forms/builder      (saveFormBuilder)   may create the form, honors
//                                                `delete: true` flags
//   PUT  /forms/update/:id   (updateFormBuilder) archives rows the request
//                                                leaves out
//
// Any section, question or sub-question id that doesn't belong to the form is
// skipped, so a request for one form can never change another form's rows.

// Ids of the rows that belong to a form
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

const ARCHIVED = 1;
const choicesFor = (type, choices) => (type === "dropdown" ? (choices ?? []) : []);
const notIn = (ids) => (row, key) => !ids.includes(row[key]);

// Walks the request's sections and saves them under formId.
//   allowDelete:   honor `delete: true` on sections/questions/sub-questions
//   existingTree:  the form's current sections (with questions and
//                  sub-questions); when given, rows missing from the request
//                  are archived
const saveSections = async (formId, sections, { transaction, allowDelete, existingTree }) => {
  const owned = await loadFormRowIds(formId, transaction);
  const opts = { transaction };

  if (existingTree) {
    const sent = sections.filter((s) => s.form_section_id).map((s) => s.form_section_id);
    for (const section of existingTree.filter((s) => notIn(sent)(s, "form_section_id"))) {
      await FormSection.update(
        { form_section_archivestatus: ARCHIVED },
        { where: { form_section_id: section.form_section_id }, ...opts },
      );
      await Questions.update(
        { form_questions_archivestatus: ARCHIVED },
        { where: { form_section_id: section.form_section_id }, ...opts },
      );
    }
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

    // Not a section of this form: ignore it and everything under it
    if (form_section_id && !owned.sections.has(Number(form_section_id))) continue;

    if (allowDelete && deleteSection && form_section_id) {
      await FormSection.update(
        { form_section_archivestatus: ARCHIVED },
        { where: { form_section_id, form_id: formId }, ...opts },
      );
      await Questions.update(
        { form_questions_archivestatus: ARCHIVED },
        { where: { form_section_id, form_id: formId }, ...opts },
      );
      continue;
    }

    let sectionId;
    if (form_section_id) {
      await FormSection.update(
        {
          form_section_name,
          form_section_description,
          form_section_archivestatus: form_section_archivestatus ?? 0,
        },
        { where: { form_section_id, form_id: formId }, ...opts },
      );
      sectionId = form_section_id;
    } else {
      const created = await FormSection.create(
        {
          form_id: formId,
          form_section_name,
          form_section_description,
          form_section_archivestatus: form_section_archivestatus ?? 0,
        },
        opts,
      );
      sectionId = created.form_section_id;
    }

    const existingQuestions = existingTree
      ? existingTree.find((s) => s.form_section_id === sectionId)?.questions || []
      : null;
    await saveQuestions(formId, sectionId, questions, existingQuestions, {
      owned,
      allowDelete,
      opts,
    });
  }
};

const saveQuestions = async (formId, sectionId, questions, existingQuestions, ctx) => {
  const { owned, allowDelete, opts } = ctx;

  if (existingQuestions) {
    const sent = questions.filter((q) => q.form_question_id).map((q) => q.form_question_id);
    for (const q of existingQuestions.filter((q) => notIn(sent)(q, "id"))) {
      await Questions.update(
        { form_questions_archivestatus: ARCHIVED },
        { where: { id: q.id }, ...opts },
      );
    }
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
    if (form_question_id && !owned.questions.has(Number(form_question_id))) continue;

    if (allowDelete && deleteQuestion && form_question_id) {
      await Questions.update(
        { form_questions_archivestatus: ARCHIVED },
        { where: { id: form_question_id, form_id: formId }, ...opts },
      );
      continue;
    }

    const fields = {
      form_questions,
      question_type,
      required,
      choices: choicesFor(question_type, choices),
      form_questions_archivestatus: form_questions_archivestatus ?? 0,
    };

    let questionId;
    if (form_question_id) {
      await Questions.update(fields, {
        where: { id: form_question_id, form_id: formId },
        ...opts,
      });
      questionId = form_question_id;
    } else {
      const created = await Questions.create(
        { form_id: formId, form_section_id: sectionId, ...fields },
        opts,
      );
      questionId = created.id;
    }

    const existingSubQs = existingQuestions
      ? existingQuestions.find((q) => q.id === questionId)?.subQuestions || []
      : null;
    await saveSubQuestions(questionId, subQuestions, existingSubQs, ctx);
  }
};

const saveSubQuestions = async (questionId, subQuestions, existingSubQs, ctx) => {
  const { owned, allowDelete, opts } = ctx;
  const ofQuestion = (sub_question_id) => ({
    where: { sub_question_id, question_id: questionId },
    ...opts,
  });

  if (existingSubQs) {
    const sent = subQuestions.filter((sq) => sq.sub_question_id).map((sq) => sq.sub_question_id);
    for (const sq of existingSubQs.filter((sq) => notIn(sent)(sq, "sub_question_id"))) {
      await SubQuestion.update(
        { sub_question_archivestatus: ARCHIVED },
        { where: { sub_question_id: sq.sub_question_id }, ...opts },
      );
    }
  }

  for (const subQ of subQuestions) {
    const {
      sub_question_id,
      sub_questions,
      question_type,
      required,
      choices,
      sub_question_archivestatus,
      delete: deleteSubQ = false,
    } = subQ;

    // Not a sub-question of this form: ignore it
    if (sub_question_id && !owned.subQuestions.has(Number(sub_question_id))) continue;

    if (allowDelete && deleteSubQ && sub_question_id) {
      await SubQuestion.update(
        { sub_question_archivestatus: ARCHIVED },
        ofQuestion(sub_question_id),
      );
      continue;
    }

    const fields = {
      sub_questions,
      question_type,
      required,
      choices: choicesFor(question_type, choices),
      sub_question_archivestatus: sub_question_archivestatus ?? 0,
    };

    if (sub_question_id) {
      await SubQuestion.update(fields, ofQuestion(sub_question_id));
    } else {
      await SubQuestion.create({ question_id: questionId, ...fields }, opts);
    }
  }
};

// POST /forms/builder — creates the form when no form_id is given, otherwise
// updates it. Saving never changes the archive status (archive has its own
// endpoint). Returns the form id.
export const saveFormBuilder = (body) =>
  sequelize.transaction(async (transaction) => {
    const {
      form_id,
      form_name,
      form_description,
      form_effective_date,
      form_revision_number,
      sections = [],
    } = body;
    const details = {
      form_name,
      form_description,
      form_effective_date: form_effective_date || null,
      form_revision_number: form_revision_number || null,
    };

    let formId = form_id;
    if (form_id) {
      await Form.update(details, { where: { id: form_id }, transaction });
    } else {
      const created = await Form.create(
        { ...details, form_archivestatus: 0 },
        { transaction },
      );
      formId = created.id;
    }

    await saveSections(formId, sections, { transaction, allowDelete: true });
    return formId;
  });

// PUT /forms/update/:id — the form comes from the URL. Rows missing from the
// request are archived.
export const updateFormBuilder = async (formId, body) => {
  if (!formId) fail(400, "Form ID is required for update");
  const { form_name, form_description, sections = [] } = body;

  await sequelize.transaction(async (transaction) => {
    await Form.update(
      { form_name, form_description },
      { where: { id: formId }, transaction },
    );

    const existingTree = await FormSection.findAll({
      where: { form_id: formId },
      include: [
        {
          model: Questions,
          as: "questions",
          include: [{ model: SubQuestion, as: "subQuestions" }],
        },
      ],
      transaction,
    });

    await saveSections(formId, sections, {
      transaction,
      allowDelete: false,
      existingTree,
    });
  });
};
