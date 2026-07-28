import express from "express";
import verifyJWT from "../middleware/verifyJWT.js";

import {
  getFormQuestionValues,
  getFormQuestionValuesByEntryId,
  getFormQuestionValueById,
  createFormQuestionValue,
  updateFormQuestionValue,
  deleteFormQuestionValue,
} from "../controllers/questionValueController.js";

const router = express.Router();

router.get("/all", getFormQuestionValues);
router.get("/entry/:form_entry_id", getFormQuestionValuesByEntryId);
router.get("/get/:id", getFormQuestionValueById);
router.post("/create", createFormQuestionValue);
router.put("/update/:id", updateFormQuestionValue);
router.delete("/:id", deleteFormQuestionValue);

export default router;
