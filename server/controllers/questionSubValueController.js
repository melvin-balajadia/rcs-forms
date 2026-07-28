import FormQuestionSubValue from "../Models/FormQuestionSubValue.js";
import FormQuestionValue from "../Models/FormQuestionValue.js";

// Get all sub-values
export const getFormQuestionSubValues = async (req, res) => {
  try {
    const subValues = await FormQuestionSubValue.findAll();
    res.status(200).json(subValues);
  } catch (error) {
    res.status(500).json({ message: "Error fetching sub-values", error });
  }
};

// Get sub-value by ID
export const getFormQuestionSubValueById = async (req, res) => {
  try {
    const subValue = await FormQuestionSubValue.findByPk(req.params.id);
    if (!subValue)
      return res.status(404).json({ message: "Sub-value not found" });

    res.status(200).json(subValue);
  } catch (error) {
    res.status(500).json({ message: "Error fetching sub-value", error });
  }
};

// Create a new sub-value with validation
export const createFormQuestionSubValue = async (req, res) => {
  try {
    const {
      form_id,
      form_question_id,
      form_question_value_id,
      form_sub_value,
      remarks,
    } = req.body;

    // Check if the related FormQuestionValue exists
    const questionValue = await FormQuestionValue.findByPk(
      form_question_value_id
    );
    if (!questionValue) {
      return res
        .status(400)
        .json({
          message:
            "Invalid form_question_value_id. Question Value does not exist.",
        });
    }

    const newSubValue = await FormQuestionSubValue.create({
      form_id,
      form_question_id,
      form_question_value_id,
      form_sub_value,
      remarks,
    });

    res
      .status(201)
      .json({
        message: "Sub-value created successfully",
        subValue: newSubValue,
      });
  } catch (error) {
    res.status(500).json({ message: "Error creating sub-value", error });
  }
};

// Update a sub-value
export const updateFormQuestionSubValue = async (req, res) => {
  try {
    const { form_sub_value, remarks } = req.body;
    const subValue = await FormQuestionSubValue.findByPk(req.params.id);

    if (!subValue)
      return res.status(404).json({ message: "Sub-value not found" });

    await subValue.update({ form_sub_value, remarks });

    res
      .status(200)
      .json({ message: "Sub-value updated successfully", subValue });
  } catch (error) {
    res.status(500).json({ message: "Error updating sub-value", error });
  }
};

// Delete a sub-value
export const deleteFormQuestionSubValue = async (req, res) => {
  try {
    const subValue = await FormQuestionSubValue.findByPk(req.params.id);
    if (!subValue)
      return res.status(404).json({ message: "Sub-value not found" });

    await subValue.destroy();
    res.status(200).json({ message: "Sub-value deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error deleting sub-value", error });
  }
};
