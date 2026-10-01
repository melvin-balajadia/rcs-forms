import sequelize from "./utilities/db.js";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import https from "https";
import { fileURLToPath } from "url";
import { dirname } from "path";

import app from "./app.js";

// Load environment variables
dotenv.config();

// Get the current module's directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const startServer = async () => {
  try {
    await sequelize.authenticate(); // Sequelize connection check
    console.log("✅ Database connection succeeded");

    await sequelize.sync({ alter: true }); // Sync models with DB (Change to { force: true } to reset tables)
    console.log("🔄 Database synchronized");
  } catch (err) {
    console.error("❌ Database connection failed:", err);
    process.exit(1); // Exit if database connection fails
  }

  // Define SSL certificate paths
  const certPath = path.join(__dirname, "certificates");
  const keyPath = path.join(certPath, "cert.key");
  const certFilePath = path.join(certPath, "server.crt");
  const caPath = path.join(certPath, "inter.crt");

  // Create HTTPS server
  const sslServer = https.createServer(
    {
      key: fs.readFileSync(keyPath, "utf8"),
      cert: fs.readFileSync(certFilePath, "utf8"),
      ca: fs.readFileSync(caPath, "utf8"),
    },
    app,
  );

  // Define ports
  const PORT_DEV = process.env.PORT_DEV || 5003;
  const PORT_TEST = process.env.PORT_TEST || 4003;
  const PORT_PROD = process.env.PORT_PROD || 8003;
  const ENV = process.env.NODE_ENV || "dev";

  // Server initialization based on environment
  switch (ENV) {
    case "test":
      if (
        !fs.existsSync(keyPath) ||
        !fs.existsSync(certFilePath) ||
        !fs.existsSync(caPath)
      ) {
        console.warn("⚠️ SSL certificates not found. Falling back to HTTP.");
        console.log(`🚀 Test server running on port ${PORT_TEST}`);
        return app.listen(PORT_TEST);
      }

      console.log(`🔒 Test server running on port ${PORT_TEST} (HTTPS)`);
      return sslServer.listen(PORT_TEST);

    case "prod":
      if (
        !fs.existsSync(keyPath) ||
        !fs.existsSync(certFilePath) ||
        !fs.existsSync(caPath)
      ) {
        console.warn("⚠️ SSL certificates not found. Falling back to HTTP.");
        console.log(`🚀 Production server running on port ${PORT_PROD}`);
        return app.listen(PORT_PROD);
      }

      console.log(`🔒 Production server running on port ${PORT_PROD} (HTTPS)`);
      return sslServer.listen(PORT_PROD);

    default:
      console.log(`🚀 Development server running on port ${PORT_DEV}`);
      return app.listen(PORT_DEV);
  }
};

startServer();
