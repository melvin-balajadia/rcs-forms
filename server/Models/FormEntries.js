import { DataTypes } from "sequelize";
import sequelize from "../utilities/db.js";
import Users from "./Users.js";
import Forms from "./Forms.js";

const FormEntries = sequelize.define(
  "FormEntries",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },

    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: Users,
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },

    form_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: Forms,
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },

    form_entry_site: {
      type: DataTypes.ENUM(
        "Taytay",
        "Cabuyao",
        "Plaridel",
        "Marilao",
        "Villasis",
      ),
      allowNull: true,
    },

    form_entry_area: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    form_entry_date: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    form_entry_archivestatus: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },

    form_entry_status: {
      type: DataTypes.ENUM(
        "draft",
        "pending",
        "returned",
        "submitted_first",
        "approved_first",
        "submitted_second",
        "approved_second",
        "submitted_third",
        "completed",
        "rejected",
      ),
      allowNull: false,
      defaultValue: "pending",
      validate: {
        isIn: [
          [
            "draft",
            "pending",
            "returned",
            "submitted_first",
            "approved_first",
            "submitted_second",
            "approved_second",
            "submitted_third",
            "completed",
            "rejected",
          ],
        ],
      },
    },

    form_entry_firstapprover_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: Users,
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    },

    form_entry_firstapprover_datetime: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    form_entry_firstapprover_remarks: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    form_entry_secondapprover_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: Users,
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    },

    form_entry_secondapprover_datetime: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    form_entry_secondapprover_remarks: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    form_entry_thirdapprover_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: Users,
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    },

    form_entry_thirdapprover_datetime: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    form_entry_thirdapprover_remarks: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    form_entry_rejector_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: Users,
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    },

    form_entry_rejector_datetime: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    form_entry_rejector_remarks: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    // ✅ NEW: Return fields
    form_entry_returner_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: Users,
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    },

    form_entry_returner_datetime: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    form_entry_returner_remarks: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    form_entry_return_count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },

    form_entry_last_return_level: {
      type: DataTypes.ENUM("first", "second", "third"),
      allowNull: true,
    },
    form_entry_resubmitted_datetime: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    tableName: "form_entries",
    timestamps: true,
  },
);

Users.hasMany(FormEntries, { foreignKey: "user_id" });
FormEntries.belongsTo(Users, { foreignKey: "user_id" });

Forms.hasMany(FormEntries, { foreignKey: "form_id" });
FormEntries.belongsTo(Forms, { foreignKey: "form_id" });

const approvalFields = [
  { key: "form_entry_firstapprover_id", as: "firstApprover" },
  { key: "form_entry_secondapprover_id", as: "secondApprover" },
  { key: "form_entry_thirdapprover_id", as: "thirdApprover" },
  { key: "form_entry_rejector_id", as: "rejector" },
  { key: "form_entry_returner_id", as: "returner" },
];

approvalFields.forEach(({ key, as }) => {
  FormEntries.belongsTo(Users, {
    foreignKey: key,
    as,
  });
});

export default FormEntries;
