import express from "express";
import verifyJWT from "../middleware/verifyJWT.js";
import {
  saveReport,
  getMySavedReports,
  getSavedReportById,
  updateSavedReport,
  deleteSavedReport,
  refreshSavedReport,
} from "../controllers/savedReports.js";

const router = express.Router();

router.post("/save", verifyJWT, saveReport);
router.get("/my-reports", verifyJWT, getMySavedReports);
router.get("/:reportId", verifyJWT, getSavedReportById);
router.put("/:reportId", verifyJWT, updateSavedReport);
router.delete("/:reportId", verifyJWT, deleteSavedReport);
router.post("/:reportId/refresh", verifyJWT, refreshSavedReport);

export default router;
