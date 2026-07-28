import express from "express";
import verifyJWT from "../middleware/verifyJWT.js";

import {
  getFormQuestionSubValues,
  getFormQuestionSubValueById,
  createFormQuestionSubValue,
  updateFormQuestionSubValue,
  deleteFormQuestionSubValue,
} from "../controllers/questionSubValueController.js";

const router = express.Router();

router.get("/all", getFormQuestionSubValues);
router.get("/get/:id", getFormQuestionSubValueById);
router.post("/create", createFormQuestionSubValue);
router.put("/update/:id", updateFormQuestionSubValue);
router.delete("/:id", deleteFormQuestionSubValue);

export default router;
