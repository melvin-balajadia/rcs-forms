import { Sequelize } from "sequelize";
import dotenv from "dotenv";
dotenv.config();

// Automated tests (vitest sets VITEST) use a throwaway in-memory SQLite DB, so
// they never touch MySQL. Every other environment is unchanged.
const sequelize = process.env.VITEST
  ? new Sequelize({ dialect: "sqlite", storage: ":memory:", logging: false })
  : new Sequelize(
      process.env.MYSQL_DATABASE,
      process.env.MYSQL_USER,
      process.env.MYSQL_PASSWORD,
      {
        host: process.env.MYSQL_HOST,
        dialect: "mysql",
        logging: false, // Disable SQL logs
      },
    );

export default sequelize;
