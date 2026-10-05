import express from "express";
import verifyJWT from "../middleware/verifyJWT.js";
import requireRole, { ADMINS } from "../middleware/requireRole.js";

import {
  createFormSection,
  getFormSections,
  getFormSectionsByFormId,
} from "../controllers/formSectionController.js";

const router = express.Router();

// Standalone EAV endpoints — the UI writes these tables through the form and
// form-entry builder endpoints, so direct access is admin-only.
router.use(verifyJWT, requireRole(...ADMINS));

router.post("/create", createFormSection);
router.get("/all", getFormSections);
router.get("/get/:form_id", getFormSectionsByFormId);

export default router;
