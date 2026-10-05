import express from "express";
import verifyJWT from "../middleware/verifyJWT.js";
import requireRole, { ADMINS } from "../middleware/requireRole.js";
import {
  getFilterOptions,
  filterFormEntries,
  getFilterStatistics,
  getFormSectionsWithMultiple,
  generateOverallAverage,
  generatePerSectionAverage,
  generatePerQuestionAverage,
  getRawAnswers,
} from "../controllers/reportController.js";

const router = express.Router();

// Reports page is admin-only
router.use(verifyJWT, requireRole(...ADMINS));

// Phase 1: Filtering endpoints
router.get("/filter-options", getFilterOptions);
router.post("/filter-entries", filterFormEntries);
router.get("/filter-statistics", getFilterStatistics);

// Phase 2: Chart generation endpoints
router.get("/forms/:formId/sections-multiple", getFormSectionsWithMultiple);
router.post("/generate-overall-average", generateOverallAverage);
router.post("/generate-per-section-average", generatePerSectionAverage);
router.post("/generate-per-question-average", generatePerQuestionAverage);

// Phase 3: Export
router.post("/raw-answers", getRawAnswers);

export default router;
