import { DataTypes } from "sequelize";
import sequelize from "../utilities/db.js";
import SavedReport from "./Reports.js";

const ReportsData = sequelize.define(
  "ReportsData",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    saved_report_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: SavedReport,
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },
    data_type: {
      type: DataTypes.STRING(50),
      allowNull: false,
      comment: "overall, section, or question",
    },

    // Context identifiers
    section_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "For section/question level data",
    },
    question_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "For question level data",
    },

    // Denormalized for easy display
    section_name: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    question_text: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    // Computed values (snapshot)
    total_questions: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    total_answers: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    yes_count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    no_count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    na_count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    average_percentage: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
    },
  },
  {
    tableName: "saved_report_data",
    timestamps: true,
  },
);

// Associations
SavedReport.hasMany(ReportsData, {
  foreignKey: "saved_report_id",
  as: "report_data",
  onDelete: "CASCADE",
});

ReportsData.belongsTo(SavedReport, {
  foreignKey: "saved_report_id",
  as: "saved_report",
});

export default ReportsData;
