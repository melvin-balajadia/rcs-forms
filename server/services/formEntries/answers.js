import FormQuestionValue from "../../Models/FormQuestionValue.js";
import FormQuestionSubValue from "../../Models/FormQuestionSubValue.js";
import Question from "../../Models/Questions.js";
import SubQuestion from "../../Models/SubQuestion.js";
import { fail } from "../../utilities/http.js";

// Saves an entry's answers and sub-answers — the one implementation used by
// both create-builder and update-builder.
//
// responses: [{ form_question_id, form_value, remarks, action_item,
//               sub_values: [{ sub_question_id, form_sub_value, remarks, action_item }] }]
//
// When `existingValues` (the entry's current answers) is given, matching
// answers are updated in place and their sub-answers replaced; otherwise every
// answer is created. Returns the saved answer rows.
export const saveAnswers = async ({
  formId,
  entryId,
  responses,
  existingValues = null,
  transaction,
}) => {
  if (!responses || responses.length === 0) return [];

  // Every question must belong to the entry's form
  const questionIds = responses.map((r) => r.form_question_id);
  const validQuestions = await Question.findAll({
    where: { id: questionIds, form_id: formId },
    transaction,
  });
  const validQuestionIds = validQuestions.map((q) => q.id);
  const invalid = questionIds.filter((id) => !validQuestionIds.includes(id));
  if (invalid.length > 0) {
    fail(400, "Some question IDs are not part of this form", { invalid });
  }

  const existingByQuestion = new Map(
    (existingValues || []).map((v) => [v.form_question_id, v]),
  );
  const isUpdate = existingValues !== null;
  const saved = [];

  for (const resp of responses) {
    const question = validQuestions.find((q) => q.id === resp.form_question_id);
    const existing = existingByQuestion.get(resp.form_question_id);

    let value;
    if (existing) {
      existing.form_value = resp.form_value;
      existing.remarks = resp.remarks;
      existing.action_item = resp.action_item || null;
      await existing.save({ transaction });
      value = existing;
    } else {
      value = await FormQuestionValue.create(
        {
          form_id: formId,
          form_entry_id: entryId,
          form_question_id: resp.form_question_id,
          form_section_id: question.form_section_id,
          form_value: resp.form_value,
          remarks: resp.remarks,
          action_item: resp.action_item || null,
        },
        { transaction },
      );
    }

    if (Array.isArray(resp.sub_values)) {
      // Replace the answer's sub-answers with the ones sent
      if (isUpdate) {
        await FormQuestionSubValue.destroy({
          where: {
            form_question_id: resp.form_question_id,
            form_question_value_id: value.id,
          },
          transaction,
        });
      }

      if (resp.sub_values.length > 0) {
        await checkSubQuestions(resp, transaction);

        const subVals = resp.sub_values.map((sub) => ({
          form_id: formId,
          form_question_id: resp.form_question_id, // parent question
          sub_question_id: sub.sub_question_id,
          form_question_value_id: value.id,
          form_sub_value: sub.form_sub_value,
          remarks: sub.remarks || null,
          action_item: sub.action_item || null,
        }));
        await FormQuestionSubValue.bulkCreate(subVals, { transaction });

        // update-builder has always echoed the saved sub-answers back
        if (isUpdate) value.dataValues.sub_values = subVals;
      }
    }

    saved.push(value);
  }

  return saved;
};

// Every sub-question must belong to the answer's parent question
const checkSubQuestions = async (resp, transaction) => {
  const subQuestionIds = resp.sub_values
    .map((s) => s.sub_question_id)
    .filter(Boolean);
  if (subQuestionIds.length === 0) return;

  const validSubQuestions = await SubQuestion.findAll({
    where: { sub_question_id: subQuestionIds, question_id: resp.form_question_id },
    transaction,
  });
  const validSubIds = validSubQuestions.map((sq) => sq.sub_question_id);
  const invalidSubs = subQuestionIds.filter((id) => !validSubIds.includes(id));
  if (invalidSubs.length > 0) {
    fail(400, "Some sub-question IDs are not part of this question", {
      invalid: invalidSubs,
    });
  }
};
