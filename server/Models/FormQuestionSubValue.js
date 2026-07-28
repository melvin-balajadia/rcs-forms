import { DataTypes } from "sequelize";
import sequelize from "../utilities/db.js";
import Form from "./Forms.js";
import Question from "./Questions.js";
import FormQuestionValue from "./FormQuestionValue.js";
import SubQuestion from "./SubQuestion.js";

const FormQuestionSubValue = sequelize.define(
  "FormQuestionSubValue",
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
    sub_question_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: SubQuestion, key: "sub_question_id" },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },
    form_question_value_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: FormQuestionValue,
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },
    form_sub_value: {
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
    tableName: "form_question_sub_values",
    timestamps: true,
  },
);

// Define associations
Form.hasMany(FormQuestionSubValue, { foreignKey: "form_id" });
FormQuestionSubValue.belongsTo(Form, { foreignKey: "form_id" });

Question.hasMany(FormQuestionSubValue, { foreignKey: "form_question_id" });
FormQuestionSubValue.belongsTo(Question, { foreignKey: "form_question_id" });

// Add this association
SubQuestion.hasMany(FormQuestionSubValue, { foreignKey: "sub_question_id" });
FormQuestionSubValue.belongsTo(SubQuestion, { foreignKey: "sub_question_id" });

FormQuestionValue.hasMany(FormQuestionSubValue, {
  foreignKey: "form_question_value_id",
});
FormQuestionSubValue.belongsTo(FormQuestionValue, {
  foreignKey: "form_question_value_id",
});

export default FormQuestionSubValue;
