import { DataTypes } from "sequelize";
import sequelize from "../utilities/db.js";
import FormApprovers from "./FormApprovers.js";

const Form = sequelize.define(
  "Form",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    form_name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    form_description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    form_archivestatus: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    form_effective_date: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    form_revision_number: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  },
  {
    tableName: "forms",
    timestamps: true,
  },
);

Form.hasMany(FormApprovers, {
  foreignKey: "form_id",
  as: "approvers",
  onDelete: "CASCADE",
});

FormApprovers.belongsTo(Form, {
  foreignKey: "form_id",
  as: "form",
});

export default Form;
