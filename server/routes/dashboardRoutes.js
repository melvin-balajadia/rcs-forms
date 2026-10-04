import express from "express";
import {
  getKeyMetrics,
  getSystemOverview,
  getRecentEntries,
  getAllDashboardData,
} from "../controllers/dashboardController.js";
import verifyJWT from "../middleware/verifyJWT.js";
import { handle } from "../utilities/http.js";
import { getDashboardCharts } from "../services/dashboard/charts.js";
import { getDashboardTodo } from "../services/dashboard/todo.js";

const router = express.Router();

// ✅ All dashboard routes require authentication
router.use(verifyJWT);

// Individual endpoints
router.get("/key-metrics", getKeyMetrics);
router.get("/system-overview", getSystemOverview);
router.get("/recent-entries", getRecentEntries);

// ✅ Single endpoint for all dashboard data (recommended for performance)
router.get("/all", getAllDashboardData);

// Charts for the dashboard's analytics section (?from&to&area&site)
router.get(
  "/charts",
  handle(async (req, res) => {
    res.status(200).json(await getDashboardCharts(req));
  }, "Error fetching dashboard charts"),
);

// To-do lists: waiting for my approval / my returned entries (?site&area)
router.get(
  "/todo",
  handle(async (req, res) => {
    res.status(200).json(await getDashboardTodo(req));
  }, "Error fetching dashboard to-do"),
);

export default router;
