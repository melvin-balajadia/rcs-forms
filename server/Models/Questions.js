import { DataTypes } from "sequelize";
import sequelize from "../utilities/db.js";
import Form from "./Forms.js";
import FormSection from "./FormSection.js";

const Question = sequelize.define(
  "Question",
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
      allowNull: true,
      references: {
        model: FormSection,
        key: "form_section_id",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },
    form_questions: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    question_type: {
      type: DataTypes.STRING, // "text", "multiple", etc.
      allowNull: false,
    },
    required: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    form_questions_archivestatus: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    choices: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: [],
    },
  },
  {
    tableName: "form_questions",
    timestamps: true,
  },
);

// Associations
Form.hasMany(Question, {
  foreignKey: "form_id",
  as: "questions",
});

Question.belongsTo(Form, {
  foreignKey: "form_id",
  as: "form",
});

FormSection.hasMany(Question, {
  foreignKey: "form_section_id",
  sourceKey: "form_section_id",
  as: "questions",
});

Question.belongsTo(FormSection, {
  foreignKey: "form_section_id",
  targetKey: "form_section_id",
  as: "section",
});

export default Question;
