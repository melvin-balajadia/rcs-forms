import { Op } from "sequelize";
import Form from "../../Models/Forms.js";
import FormSection from "../../Models/FormSection.js";
import Questions from "../../Models/Questions.js";
import SubQuestion from "../../Models/SubQuestion.js";
import { getPagination } from "../../utilities/pagination.js";
import { fail } from "../../utilities/http.js";

const ACTIVE = { form_archivestatus: 0 };

// Active forms (archived forms are hidden)
export const listActiveForms = () => Form.findAll({ where: ACTIVE });

export const listForms = async (query) => {
  const { page, pageSize, offset } = getPagination(query);
  const { id, form_name, from, to } = query;

  const where = { ...ACTIVE };
  if (id) where.id = id;
  if (form_name) where.form_name = { [Op.like]: `%${form_name}%` };
  if (from && to) where.createdAt = { [Op.between]: [from, to] };

  const { rows: forms, count } = await Form.findAndCountAll({
    where,
    order: [["id", "ASC"]],
    limit: pageSize,
    offset,
  });

  return {
    message: "Forms fetched successfully",
    total: count,
    totalPages: Math.ceil(count / pageSize),
    currentPage: page,
    pageSize,
    forms,
  };
};

// A form with its active sections, questions and sub-questions. Archived
// forms are still returned: their existing entries need the structure.
export const getFormTree = async (formId) => {
  const form = await Form.findByPk(formId, {
    include: [
      {
        model: FormSection,
        as: "sections",
        where: { form_section_archivestatus: 0 },
        required: false, // LEFT JOIN: the form returns even with no sections
        include: [
          {
            model: Questions,
            as: "questions",
            where: { form_questions_archivestatus: 0 },
            required: false,
            include: [
              {
                model: SubQuestion,
                as: "subQuestions",
                where: { sub_question_archivestatus: 0 },
                required: false,
              },
            ],
          },
        ],
      },
    ],
  });
  if (!form) fail(404, "Form not found");
  return form;
};

export const createForm = ({ form_name, form_description }) =>
  Form.create({ form_name, form_description });

// Archive: hidden from form lists and can't receive new entries, but nothing
// is deleted. Its existing entries stay viewable.
export const archiveForm = async (formId) => {
  const form = await Form.findOne({ where: { id: formId, ...ACTIVE } });
  if (!form) fail(404, "Form not found");
  await form.update({ form_archivestatus: 1 });
};
