import Question from "../Models/Questions.js";
import Form from "../Models/Forms.js";
import FormSection from "../Models/FormSection.js";

// Get all questions
export const getQuestions = async (req, res) => {
  try {
    const questions = await Question.findAll({
      include: [
        { model: Form, attributes: ["id", "form_name"] },
        {
          model: FormSection,
          attributes: ["form_section_id", "form_section_name"],
        },
      ],
    });
    res.status(200).json(questions);
  } catch (error) {
    res.status(500).json({ message: "Error fetching questions", error });
  }
};

// Get all questions by form ID (with Form details)
export const getQuestionsByFormId = async (req, res) => {
  try {
    const formId = parseInt(req.params.id, 10);
    if (isNaN(formId)) {
      return res.status(400).json({ message: "Invalid form ID" });
    }

    // Check if form exists
    const form = await Form.findByPk(formId, {
      attributes: ["id", "form_name", "form_description"],
    });

    if (!form) {
      return res.status(404).json({ message: "Form not found" });
    }

    // Fetch all sections with their questions
    const sections = await FormSection.findAll({
      where: { form_id: formId },
      attributes: ["form_section_id", "form_section_name"],
      include: [
        {
          model: Question,
          as: "questions",
          attributes: ["id", "form_questions", "form_questions_archivestatus"],
        },
      ],
    });

    res.status(200).json({
      form,
      sections,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error fetching questions by form ID",
      error: error.message,
    });
  }
};

// Get a single question by ID
export const getQuestionById = async (req, res) => {
  try {
    const question = await Question.findByPk(req.params.id, {
      include: [
        { model: Form, attributes: ["id", "form_name"] },
        {
          model: FormSection,
          attributes: ["form_section_id", "form_section_name"],
        },
      ],
    });

    if (!question)
      return res.status(404).json({ message: "Question not found" });

    res.status(200).json(question);
  } catch (error) {
    res.status(500).json({ message: "Error fetching question", error });
  }
};

// Create a new question
export const createQuestion = async (req, res) => {
  try {
    const { form_id, form_section_id, form_questions } = req.body;

    // Check if form exists
    const form = await Form.findByPk(form_id);
    if (!form) {
      return res.status(404).json({ message: "Form not found" });
    }

    // Check if section exists and belongs to the form
    const section = await FormSection.findOne({
      where: {
        form_section_id,
        form_id,
      },
    });

    if (!section) {
      return res.status(400).json({
        message: "Section not found or does not belong to the specified form",
      });
    }

    // Validate form_questions is an array
    if (!Array.isArray(form_questions) || form_questions.length === 0) {
      return res
        .status(400)
        .json({ message: "form_questions must be a non-empty array" });
    }

    // Prepare the question data for bulk creation
    const questionsToCreate = form_questions.map((q) => ({
      form_id,
      form_section_id,
      form_questions: q.form_questions,
      form_questions_archivestatus: q.form_questions_archivestatus || 0,
    }));

    // Bulk create questions
    const createdQuestions = await Question.bulkCreate(questionsToCreate);

    res.status(201).json({
      message: "Questions created successfully",
      questions: createdQuestions,
    });
  } catch (error) {
    res.status(500).json({ message: "Error creating questions", error });
  }
};

// Update a question
export const updateQuestion = async (req, res) => {
  try {
    const { form_questions, form_questions_archivestatus, form_section_id } =
      req.body;

    const question = await Question.findByPk(req.params.id);
    if (!question) {
      return res.status(404).json({ message: "Question not found" });
    }

    // Optional: validate form_section_id belongs to same form_id
    if (form_section_id) {
      const section = await FormSection.findOne({
        where: {
          form_section_id,
          form_id: question.form_id,
        },
      });

      if (!section) {
        return res.status(400).json({
          message: "New section does not belong to the same form",
        });
      }
    }

    await question.update({
      form_questions,
      form_questions_archivestatus,
      form_section_id,
    });

    res
      .status(200)
      .json({ message: "Question updated successfully", question });
  } catch (error) {
    res.status(500).json({ message: "Error updating question", error });
  }
};

// Delete a question
export const deleteQuestion = async (req, res) => {
  try {
    const question = await Question.findByPk(req.params.id);
    if (!question)
      return res.status(404).json({ message: "Question not found" });

    await question.destroy();
    res.status(200).json({ message: "Question deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error deleting question", error });
  }
};
