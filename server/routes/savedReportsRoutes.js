import express from "express";
import verifyJWT from "../middleware/verifyJWT.js";
import requireRole, { ADMINS } from "../middleware/requireRole.js";
import {
  saveReport,
  getMySavedReports,
  getSavedReportById,
  updateSavedReport,
  deleteSavedReport,
  refreshSavedReport,
} from "../controllers/savedReports.js";
import { validate } from "../middleware/validate.js";
import {
  saveReportSchema,
  updateSavedReportSchema,
} from "../validation/schemas.js";

const router = express.Router();

// Reports page is admin-only
router.use(verifyJWT, requireRole(...ADMINS));

router.post("/save", validate(saveReportSchema), saveReport);
router.get("/my-reports", getMySavedReports);
router.get("/:reportId", getSavedReportById);
router.put("/:reportId", validate(updateSavedReportSchema), updateSavedReport);
router.delete("/:reportId", deleteSavedReport);
router.post("/:reportId/refresh", refreshSavedReport);

export default router;
