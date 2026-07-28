import { DataTypes } from "sequelize";
import sequelize from "../utilities/db.js";

const Rooms = sequelize.define(
  "Rooms",
  {
    room_id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    room_name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    room_description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    room_site: {
      type: DataTypes.ENUM,
      values: ["Taytay", "Marilao", "Cabuyao", "Plaridel", "Villasis"],
      allowNull: false,
    },
    room_location: {
      type: DataTypes.ENUM,
      values: ["Main", "Annex", "Dry"],
      allowNull: false,
    },
    room_archivestatus: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
  },
  {
    tableName: "rooms",
    timestamps: true,
  }
);

export default Rooms;
