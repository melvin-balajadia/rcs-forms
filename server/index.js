import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import bodyParser from "body-parser";
import sequelize from "./utilities/db.js";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import https from "https";
import "express-async-errors";

// Utility Imports
import corsOptions from "./config/corsOption.js";
import credentials from "./middleware/credentials.js";
import { fileURLToPath } from "url";
import { dirname } from "path";

// Import Models
import "./Models/Forms.js";
import "./Models/Questions.js";
import "./Models/FormQuestionValue.js";
import "./Models/FormQuestionSubValue.js";
import "./Models/Users.js";
import "./Models/FormEntries.js";
import "./Models/Clients.js";
import "./Models/Rooms.js";
import "./Models/FormSection.js";
import "./Models/SubQuestion.js";
import "./Models/Reports.js";
import "./Models/ReportsData.js";
import "./Models/FormApprovers.js";

// Load environment variables
dotenv.config();

// Get the current module's directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize Express
const app = express();

// Middleware
app.use(credentials);
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// Import Routes
import formRoutes from "./routes/formRoutes.js";
import questionsRoutes from "./routes/questionsRoutes.js";
import questionValueRoutes from "./routes/questionValueRoutes.js";
import questionSubValueRoutes from "./routes/questionSubValueRoutes.js";
import formEntriesRoutes from "./routes/formEntriesRoutes.js";
import clientsRoutes from "./routes/clientsRoutes.js";
import roomsRoutes from "./routes/roomsRoutes.js";
import formSectionRoutes from "./routes/formSectionRoutes.js";
import usersRoutes from "./routes/usersRoutes.js";
import userAuthRoutes from "./routes/userAuthRoutes.js";
import reportRoutes from "./routes/reportsRoutes.js";
import savedReportsRoutes from "./routes/savedReportsRoutes.js";
import formApproverRoutes from "./routes/formApproverRoutes.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";

// Route Middleware
app.use("/api/forms", formRoutes);
app.use("/api/questions", questionsRoutes);
app.use("/api/questions-value", questionValueRoutes);
app.use("/api/questions-sub-value", questionSubValueRoutes);
app.use("/api/form-entries", formEntriesRoutes);
app.use("/api/clients", clientsRoutes);
app.use("/api/rooms", roomsRoutes);
app.use("/api/form-section", formSectionRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/auth", userAuthRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/saved-reports", savedReportsRoutes);
app.use("/api/form-approvers", formApproverRoutes);
app.use("/api/dashboard", dashboardRoutes);

// Global Error Handler
app.use((err, req, res, next) => {
  console.error("Error:", err);
  res
    .status(err.status || 500)
    .json({ message: "Internal Server Error", error: err.toString() });
});

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
