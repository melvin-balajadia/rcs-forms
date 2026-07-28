import express from "express";
import verifyJWT from "../middleware/verifyJWT.js";

import {
  createFormSection,
  getFormSections,
  getFormSectionsByFormId,
} from "../controllers/formSectionController.js";

const router = express.Router();

router.post("/create", createFormSection);
router.get("/all", getFormSections);
router.get("/get/:form_id", getFormSectionsByFormId);

export default router;
