import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import "express-async-errors";

// Utility Imports
import corsOptions from "./config/corsOption.js";
import credentials from "./middleware/credentials.js";
import { rejectNestedQuery } from "./middleware/validate.js";

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

// The Express app, without starting a server — index.js listens on it, and
// tests load it directly with supertest.
const app = express();

// Middleware
// Security headers. The API only serves JSON; "same-site" lets the client
// (same host, different port) read it.
app.use(helmet({ crossOriginResourcePolicy: { policy: "same-site" } }));
app.use(credentials);
app.use(cors(corsOptions));
// 1 MB fits a full report request (up to 10,000 entry ids plus its snapshot)
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(rejectNestedQuery);

// Never send internals to the browser on a server error. Many handlers answer
// 500 with the raw error (Sequelize errors include the SQL); this keeps their
// human-readable message, drops everything else, and logs the original.
app.use((req, res, next) => {
  const json = res.json.bind(res);
  res.json = (body) => {
    if (res.statusCode < 500) return json(body);
    console.error(`${req.method} ${req.originalUrl} → ${res.statusCode}`, body);
    const message =
      typeof body?.message === "string"
        ? body.message
        : typeof body?.ErrorMessage === "string"
          ? body.ErrorMessage
          : "Internal Server Error";
    return json({ message, ErrorMessage: message, ErrorState: true });
  };
  next();
});

// Liveness probe — hit directly through nginx's TCP passthrough, no auth required
app.get("/health", (req, res) => res.status(200).json({ status: "ok" }));

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

// Global Error Handler — details go to the server log only
app.use((err, req, res, next) => {
  console.error("Error:", err);
  const status = err.status || err.statusCode || 500;

  // Request errors raised by Express itself (bad JSON, body too large)
  if (status < 500) {
    const message =
      err.type === "entity.too.large"
        ? "Request is too large"
        : err.type === "entity.parse.failed"
          ? "Request body is not valid JSON"
          : "Bad request";
    return res.status(status).json({ message });
  }

  res.status(500).json({ message: "Internal Server Error" });
});

export default app;
