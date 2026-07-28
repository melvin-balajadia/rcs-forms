import express from "express";
import {
  getKeyMetrics,
  getSystemOverview,
  getRecentEntries,
  getAllDashboardData,
} from "../controllers/dashboardController.js";
import verifyJWT from "../middleware/verifyJWT.js";

const router = express.Router();

// ✅ All dashboard routes require authentication
router.use(verifyJWT);

// Individual endpoints
router.get("/key-metrics", getKeyMetrics);
router.get("/system-overview", getSystemOverview);
router.get("/recent-entries", getRecentEntries);

// ✅ Single endpoint for all dashboard data (recommended for performance)
router.get("/all", getAllDashboardData);

export default router;
