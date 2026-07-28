import { DataTypes } from "sequelize";
import sequelize from "../utilities/db.js";
import Question from "./Questions.js";

const SubQuestion = sequelize.define(
  "SubQuestion",
  {
    sub_question_id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    question_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: Question,
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },
    sub_questions: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    question_type: {
      type: DataTypes.STRING, // "text", "multiple", etc.
      allowNull: true,
    },
    required: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    sub_question_archivestatus: {
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
    tableName: "form_sub_questions",
    timestamps: true,
  },
);

// Associations
Question.hasMany(SubQuestion, {
  foreignKey: "question_id",
  as: "subQuestions",
});

SubQuestion.belongsTo(Question, {
  foreignKey: "question_id",
  as: "question",
});

export default SubQuestion;
