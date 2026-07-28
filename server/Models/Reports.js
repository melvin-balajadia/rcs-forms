import { DataTypes } from "sequelize";
import sequelize from "../utilities/db.js";
import User from "./Users.js";
import Form from "./Forms.js";
import FormSection from "./FormSection.js";

const Reports = sequelize.define(
  "Reports",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    report_name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    report_description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    created_by: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: User,
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
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

    // Phase 1 Filters
    filter_site: {
      type: DataTypes.STRING(50),
      allowNull: true, // NULL means "All Sites"
    },
    filter_area: {
      type: DataTypes.STRING(50),
      allowNull: true, // NULL means "All Areas"
    },
    filter_date_from: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    filter_date_to: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    entries_count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },

    // Store entry IDs as JSON array for regeneration
    entry_ids: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [],
      comment: "Array of form_entry_id values that matched the filter",
    },

    // Phase 2 & 3 Chart Settings
    chart_type: {
      type: DataTypes.STRING(50),
      allowNull: false,
      comment: "overall, per_section, or per_question",
    },
    chart_condition: {
      type: DataTypes.STRING(5),
      allowNull: false,
      comment: "Y, N, or NA",
    },
    chart_section_id: {
      type: DataTypes.INTEGER,
      allowNull: true, // NULL means "All Sections"
      references: {
        model: FormSection,
        key: "form_section_id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    },

    // Light Snapshot - Summary Statistics
    snapshot_overall_average: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
      comment: "Overall average percentage at time of save",
    },
    snapshot_yes_total: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    snapshot_no_total: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    snapshot_na_total: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    snapshot_total_answers: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    // Metadata
    last_viewed_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    is_archived: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
  },
  {
    tableName: "saved_reports",
    timestamps: true, // createdAt, updatedAt
  },
);

// Associations
User.hasMany(Reports, {
  foreignKey: "created_by",
  as: "saved_reports",
});

Reports.belongsTo(User, {
  foreignKey: "created_by",
  as: "creator",
});

Form.hasMany(Reports, {
  foreignKey: "form_id",
  as: "saved_reports",
});

Reports.belongsTo(Form, {
  foreignKey: "form_id",
  as: "form",
});

FormSection.hasMany(Reports, {
  foreignKey: "chart_section_id",
  as: "saved_reports",
});

Reports.belongsTo(FormSection, {
  foreignKey: "chart_section_id",
  as: "chart_section",
});

export default Reports;
