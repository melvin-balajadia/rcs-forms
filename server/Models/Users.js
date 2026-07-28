import { DataTypes } from "sequelize";
import sequelize from "../utilities/db.js";
import FormApprovers from "./FormApprovers.js";

const Users = sequelize.define(
  "Users",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    user_firstname: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    user_middlename: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    user_lastname: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    user_email: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        isEmail: true,
      },
    },
    user_contact: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    user_address: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    user_groups: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: ["requestor"],
      validate: {
        isValidRoles(value) {
          const validRoles = [
            "requestor",
            "approver",
            "all_access",
            "qfd_admin",
          ];

          if (!Array.isArray(value)) {
            throw new Error("user_groups must be an array");
          }

          if (value.length === 0) {
            throw new Error("User must have at least one role");
          }

          const invalidRoles = value.filter(
            (role) => !validRoles.includes(role),
          );
          if (invalidRoles.length > 0) {
            throw new Error(`Invalid roles: ${invalidRoles.join(", ")}`);
          }

          const hasRequestor = value.includes("requestor");
          const hasApprover = value.includes("approver");
          const hasAllAccess = value.includes("all_access");
          const hasQfdAdmin = value.includes("qfd_admin");

          if (hasAllAccess && value.length > 1) {
            throw new Error("all_access cannot be combined with other roles");
          }

          if (hasQfdAdmin && value.length > 1) {
            throw new Error("qfd_admin cannot be combined with other roles");
          }

          if (hasRequestor && hasApprover) {
            throw new Error("A requestor cannot also be an approver");
          }

          if (hasRequestor && value.length > 1) {
            throw new Error("Requestor cannot be combined with other roles");
          }
        },
      },
      comment:
        "User roles as JSON array. Must be one of: requestor, approver, all_access, qfd_admin.",
    },
    user_department: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    user_site: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    user_username: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    user_password: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    user_reset_token: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment:
        "false = password reset required, true = user has set their own password",
    },
    user_archivestatus: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: "0 = active, 1 = archived",
    },
    user_refreshtoken: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    tableName: "users",
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ["user_email"],
      },
      {
        unique: true,
        fields: ["user_username"],
      },
    ],
  },
);

Users.hasMany(FormApprovers, {
  foreignKey: "user_id",
  as: "formApprovals",
  onDelete: "CASCADE",
});

FormApprovers.belongsTo(Users, {
  foreignKey: "user_id",
  as: "user",
});

export default Users;
