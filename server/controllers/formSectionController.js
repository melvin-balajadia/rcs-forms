import FormSection from "../Models/FormSection.js";
import Form from "../Models/Forms.js";

export const createFormSection = async (req, res) => {
  try {
    const { form_id, form_section_name, form_section_description } = req.body;

    const formExists = await Form.findByPk(form_id);
    if (!formExists) {
      return res.status(404).json({ message: "Form not found" });
    }

    const newFormSection = await FormSection.create({
      form_id,
      form_section_name,
      form_section_description,
    });

    res.status(201).json({
      message: "Form section created successfully",
      section: newFormSection,
    });
  } catch (error) {
    res.status(500).json({ message: "Error creating form section", error });
  }
};

export const getFormSections = async (req, res) => {
  try {
    const sections = await FormSection.findAll({
      where: {
        form_section_archivestatus: 0,
      },
      include: [
        {
          model: Form,
          as: "form",
          attributes: ["id", "form_name"], // Adjust attributes as needed
        },
      ],
    });
    res.status(200).json(sections);
  } catch (error) {
    res.status(500).json({ message: "Error fetching form sections", error });
  }
};

export const getFormSectionsByFormId = async (req, res) => {
  try {
    const { form_id } = req.params;

    const sections = await FormSection.findAll({
      where: {
        form_id,
        form_section_archivestatus: 0,
      },
      include: [
        {
          model: Form,
          as: "form",
          attributes: ["id", "form_name"], // Adjust attributes as needed
        },
      ],
    });

    if (sections.length === 0) {
      return res
        .status(404)
        .json({ message: "No sections found for this form" });
    }

    res.status(200).json(sections);
  } catch (error) {
    res.status(500).json({ message: "Error fetching form sections", error });
  }
};
