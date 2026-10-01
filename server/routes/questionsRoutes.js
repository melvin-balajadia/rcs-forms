import express from "express";
import verifyJWT from "../middleware/verifyJWT.js";
import requireRole, { ADMINS } from "../middleware/requireRole.js";

import {
  getQuestions,
  getQuestionById,
  getQuestionsByFormId,
  createQuestion,
  updateQuestion,
  deleteQuestion,
} from "../controllers/questionsController.js";

const router = express.Router();

// Standalone EAV endpoints — the UI writes these tables through the form and
// form-entry builder endpoints, so direct access is admin-only.
router.use(verifyJWT, requireRole(...ADMINS));

router.get("/all", getQuestions);
router.get("/get/:id", getQuestionById);
router.get("/get-form/:id", getQuestionsByFormId);
router.post("/create", createQuestion);
router.put("/update/:id", updateQuestion);
router.delete("/:id", deleteQuestion);

export default router;
