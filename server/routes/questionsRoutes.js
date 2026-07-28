import express from "express";
import verifyJWT from "../middleware/verifyJWT.js";

import {
  getQuestions,
  getQuestionById,
  getQuestionsByFormId,
  createQuestion,
  updateQuestion,
  deleteQuestion,
} from "../controllers/questionsController.js";

const router = express.Router();

router.get("/all", getQuestions);
router.get("/get/:id", getQuestionById);
router.get("/get-form/:id", getQuestionsByFormId);
router.post("/create", createQuestion);
router.put("/update/:id", updateQuestion);
router.delete("/:id", deleteQuestion);

export default router;
