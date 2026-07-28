import FormQuestionValue from "../Models/FormQuestionValue.js";
import Question from "../Models/Questions.js";
import FormEntries from "../Models/FormEntries.js";
import Form from "../Models/Forms.js";
import FormQuestionSubValue from "../Models/FormQuestionSubValue.js";

// Get all form question values
export const getFormQuestionValues = async (req, res) => {
  try {
    const values = await FormQuestionValue.findAll();
    res.status(200).json(values);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching form question values", error });
  }
};

// Get all form question values by form_entry_id
export const getFormQuestionValuesByEntryId = async (req, res) => {
  try {
    const { form_entry_id } = req.params;

    const values = await FormQuestionValue.findAll({
      where: { form_entry_id },
      attributes: ["id", "form_value", "remarks", "form_section_id"],
      include: [
        {
          model: Question,
          attributes: ["id", "form_questions"],
        },
        {
          model: FormQuestionSubValue,
          attributes: ["id", "form_sub_value", "remarks"],
        },
        {
          model: FormEntries,
          attributes: [
            "form_id",
            "form_entry_area",
            "form_entry_site",
            "form_entry_date",
          ],
          include: [
            {
              model: Form,
              attributes: ["id", "form_name"],
            },
          ],
        },
      ],
    });

    if (!values.length) {
      return res.status(404).json({ message: "No records found." });
    }

    const first = values[0];
    const formEntryInfo = {
      form_id: first.FormEntry?.form_id || null,
      form_name: first.FormEntry?.Form?.form_name || "Unknown Form",
      form_entry_area: first.FormEntry?.form_entry_area || null,
      form_entry_site: first.FormEntry?.form_entry_site || null,
      form_entry_date: first.FormEntry?.form_entry_date || null,
    };

    const formattedValues = values.map((value) => ({
      form_question_id: value.Question?.id || null,
      form_question: value.Question?.form_questions || "Unknown Question",
      form_value: value.form_value,
      form_section_id: value.form_section_id || null,
      remarks: value.remarks,
      form_question_sub_values: value.FormQuestionSubValues.map((subValue) => ({
        sub_value_id: subValue.id,
        form_sub_value: subValue.form_sub_value,
        remarks: subValue.remarks,
      })),
    }));

    res.status(200).json({
      message: "Form Question Values Retrieved Successfully",
      form_entry_info: formEntryInfo,
      form_question_values: formattedValues,
    });
  } catch (error) {
    console.error("Error fetching form question values:", error);
    res.status(500).json({
      message: "Error fetching form question values",
      error: error.message,
    });
  }
};

// Get a single form question value by ID
export const getFormQuestionValueById = async (req, res) => {
  try {
    const value = await FormQuestionValue.findByPk(req.params.id);
    if (!value)
      return res.status(404).json({ message: "Form question value not found" });

    res.status(200).json(value);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching form question value", error });
  }
};

// Create a new form question value (Answer)
export const createFormQuestionValue = async (req, res) => {
  try {
    const { form_id, form_entry_id, responses } = req.body;

    if (!Array.isArray(responses) || responses.length === 0) {
      return res
        .status(400)
        .json({ message: "Responses should be a non-empty array" });
    }

    // Check if the form entry exists
    const formEntry = await FormEntries.findByPk(form_entry_id);
    if (!formEntry) {
      return res.status(404).json({ message: "Form entry not found" });
    }

    // Extract question IDs
    const questionIds = responses.map((resp) =>
      parseInt(resp.form_question_id, 10)
    );

    // Fetch questions by ID and form_id
    const existingQuestions = await Question.findAll({
      where: {
        id: questionIds,
        form_id: form_id,
      },
      attributes: ["id", "form_section_id", "form_id"],
    });

    // Map question_id → form_section_id
    const questionSectionMap = {};
    existingQuestions.forEach((q) => {
      questionSectionMap[q.id] = q.form_section_id;
    });

    // Check for invalid or mismatched questions
    const invalidQuestions = questionIds.filter(
      (id) => !questionSectionMap[id]
    );
    if (invalidQuestions.length > 0) {
      return res.status(400).json({
        message: "Some question IDs are not part of the specified form_id",
        invalidQuestions,
      });
    }

    // Insert the answers
    const newValues = await FormQuestionValue.bulkCreate(
      responses.map(({ form_question_id, form_value, remarks }) => ({
        form_id,
        form_entry_id,
        form_question_id,
        form_value,
        remarks,
        form_section_id: questionSectionMap[form_question_id],
      }))
    );

    res.status(201).json({
      message: "Form question values created successfully",
      values: newValues,
    });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({
      message: "Error creating form question values",
      error: error.message,
    });
  }
};

// Update a form question value
export const updateFormQuestionValue = async (req, res) => {
  try {
    const { form_id, form_question_id, form_value, remarks } = req.body;
    const value = await FormQuestionValue.findByPk(req.params.id);
    if (!value)
      return res.status(404).json({ message: "Form question value not found" });

    // Check if the question exists
    const question = await Question.findByPk(form_question_id);
    if (!question)
      return res.status(404).json({ message: "Question not found" });

    await value.update({ form_id, form_question_id, form_value, remarks });
    res
      .status(200)
      .json({ message: "Form question value updated successfully", value });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error updating form question value", error });
  }
};

// Delete a form question value
export const deleteFormQuestionValue = async (req, res) => {
  try {
    const value = await FormQuestionValue.findByPk(req.params.id);
    if (!value)
      return res.status(404).json({ message: "Form question value not found" });

    await value.destroy();
    res
      .status(200)
      .json({ message: "Form question value deleted successfully" });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error deleting form question value", error });
  }
};
