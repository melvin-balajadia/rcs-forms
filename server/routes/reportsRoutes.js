import express from "express";
import verifyJWT from "../middleware/verifyJWT.js";
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

// Phase 1: Filtering endpoints
router.get("/filter-options", verifyJWT, getFilterOptions);
router.post("/filter-entries", verifyJWT, filterFormEntries);
router.get("/filter-statistics", verifyJWT, getFilterStatistics);

// Phase 2: Chart generation endpoints
router.get(
  "/forms/:formId/sections-multiple",
  verifyJWT,
  getFormSectionsWithMultiple,
);
router.post("/generate-overall-average", verifyJWT, generateOverallAverage);
router.post(
  "/generate-per-section-average",
  verifyJWT,
  generatePerSectionAverage,
);
router.post(
  "/generate-per-question-average",
  verifyJWT,
  generatePerQuestionAverage,
);

// Phase 3: Export
router.post("/raw-answers", verifyJWT, getRawAnswers);

export default router;
