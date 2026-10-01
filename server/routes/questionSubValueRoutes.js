import express from "express";
import verifyJWT from "../middleware/verifyJWT.js";
import requireRole, { ADMINS } from "../middleware/requireRole.js";

import {
  getFormQuestionSubValues,
  getFormQuestionSubValueById,
  createFormQuestionSubValue,
  updateFormQuestionSubValue,
  deleteFormQuestionSubValue,
} from "../controllers/questionSubValueController.js";

const router = express.Router();

// Standalone EAV endpoints — the UI writes these tables through the form and
// form-entry builder endpoints, so direct access is admin-only.
router.use(verifyJWT, requireRole(...ADMINS));

router.get("/all", getFormQuestionSubValues);
router.get("/get/:id", getFormQuestionSubValueById);
router.post("/create", createFormQuestionSubValue);
router.put("/update/:id", updateFormQuestionSubValue);
router.delete("/:id", deleteFormQuestionSubValue);

export default router;
