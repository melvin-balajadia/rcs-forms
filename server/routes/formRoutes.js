import express from "express";
import verifyJWT from "../middleware/verifyJWT.js";

import {
  getForms,
  getFormById,
  createForm,
  deleteForm,
  formsPagination,
  submitFormBuilder,
  updateFormBuilder,
} from "../controllers/formsController.js";

const router = express.Router();

router.get("/all", verifyJWT, getForms);
router.get("/pagination", verifyJWT, formsPagination);
router.get("/get/:id", verifyJWT, getFormById);
router.post("/create", verifyJWT, createForm);
router.post("/builder", verifyJWT, submitFormBuilder);
router.put("/update/:id", verifyJWT, updateFormBuilder);
router.delete("/:id", verifyJWT, deleteForm);

export default router;
