import express from "express";
import {
  getKeyMetrics,
  getSystemOverview,
  getRecentEntries,
  getAllDashboardData,
} from "../controllers/dashboardController.js";
import verifyJWT from "../middleware/verifyJWT.js";
import { handle } from "../utilities/http.js";
import { getDashboardAnalytics } from "../services/dashboard/analytics.js";

const router = express.Router();

// ✅ All dashboard routes require authentication
router.use(verifyJWT);

// Individual endpoints
router.get("/key-metrics", getKeyMetrics);
router.get("/system-overview", getSystemOverview);
router.get("/recent-entries", getRecentEntries);

// ✅ Single endpoint for all dashboard data (recommended for performance)
router.get("/all", getAllDashboardData);

// Everything in the dashboard analytics section (?from&to&area&site)
router.get(
  "/analytics",
  handle(async (req, res) => {
    res.status(200).json(await getDashboardAnalytics(req));
  }, "Error fetching dashboard analytics"),
);

export default router;
