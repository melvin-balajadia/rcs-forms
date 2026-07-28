import { DataTypes } from "sequelize";
import sequelize from "../utilities/db.js";

const FormApprovers = sequelize.define(
  "FormApprovers",
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
        model: "forms",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "users",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },
    approval_level: {
      type: DataTypes.ENUM("first", "second", "third"),
      allowNull: false,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  },
  {
    tableName: "form_approvers",
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ["form_id", "user_id", "approval_level"],
        name: "unique_form_user_level",
      },
      {
        fields: ["form_id"],
        name: "idx_form_id",
      },
      {
        fields: ["user_id"],
        name: "idx_user_id",
      },
      {
        fields: ["form_id", "approval_level"],
        name: "idx_form_level",
      },
      {
        fields: ["is_active"],
        name: "idx_is_active",
      },
    ],
  },
);

export default FormApprovers;
