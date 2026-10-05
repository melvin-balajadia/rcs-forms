import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import "express-async-errors";

// Utility Imports
import corsOptions from "./config/corsOption.js";
import credentials from "./middleware/credentials.js";

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
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

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

// Global Error Handler
app.use((err, req, res, next) => {
  console.error("Error:", err);
  res
    .status(err.status || 500)
    .json({ message: "Internal Server Error", error: err.toString() });
});

export default app;
