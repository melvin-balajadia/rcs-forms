import { DataTypes } from "sequelize";
import sequelize from "../utilities/db.js";
import Form from "./Forms.js";

const FormSection = sequelize.define(
  "FormSection",
  {
    form_section_id: {
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
    form_section_name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    form_section_description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    form_section_archivestatus: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
  },
  {
    tableName: "form_section",
    timestamps: true,
  }
);

// ✅ Associations
Form.hasMany(FormSection, {
  foreignKey: "form_id",
  as: "sections", // 🔑 use this in your include
});

FormSection.belongsTo(Form, {
  foreignKey: "form_id",
  as: "form",
});

export default FormSection;
