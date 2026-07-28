import { DataTypes } from "sequelize";
import sequelize from "../utilities/db.js";
import Form from "./Forms.js";
import Question from "./Questions.js";
import FormEntries from "./FormEntries.js";
import FormSection from "./FormSection.js";

const FormQuestionValue = sequelize.define(
  "FormQuestionValue",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    form_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: Form,
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },
    form_section_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: FormSection,
        key: "form_section_id",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },
    form_question_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: Question,
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },
    form_entry_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: FormEntries,
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },
    form_value: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    remarks: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    action_item: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    tableName: "form_question_values",
    timestamps: true,
  }
);

// Define associations
Form.hasMany(FormQuestionValue, { foreignKey: "form_id" });
FormQuestionValue.belongsTo(Form, { foreignKey: "form_id" });

FormSection.hasMany(FormQuestionValue, { foreignKey: "form_section_id" });
FormQuestionValue.belongsTo(FormSection, { foreignKey: "form_section_id" });

Question.hasMany(FormQuestionValue, { foreignKey: "form_question_id" });
FormQuestionValue.belongsTo(Question, { foreignKey: "form_question_id" });

FormEntries.hasMany(FormQuestionValue, { foreignKey: "form_entry_id" });
FormQuestionValue.belongsTo(FormEntries, { foreignKey: "form_entry_id" });

export default FormQuestionValue;
