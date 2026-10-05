import { DataTypes } from "sequelize";
import sequelize from "../utilities/db.js";
import FormApprovers from "./FormApprovers.js";
import { roleListError } from "../utilities/userRoles.js";

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
        // Same rules as create/edit user (utilities/userRoles.js)
        isValidRoles(value) {
          const error = roleListError(value);
          if (error) throw new Error(error);
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
    // Never send the password hash or refresh token to clients. This also
    // applies when Users is included from other models (e.g. FormEntries).
    defaultScope: {
      attributes: { exclude: ["user_password", "user_refreshtoken"] },
    },
    scopes: {
      // Only for auth flows that must read the password hash
      withSecrets: {},
    },
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
