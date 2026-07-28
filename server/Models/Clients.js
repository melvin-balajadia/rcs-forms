import { DataTypes } from "sequelize";
import sequelize from "../utilities/db.js";

const Clients = sequelize.define(
  "Clients",
  {
    clients_id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    clients_name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    clients_description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    clients_site: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    clients_archivestatus: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
  },
  {
    tableName: "clients",
    timestamps: true,
  }
);

export default Clients;
