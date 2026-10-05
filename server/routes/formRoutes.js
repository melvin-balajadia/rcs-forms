import express from "express";
import verifyJWT from "../middleware/verifyJWT.js";
import requireRole, { ADMINS } from "../middleware/requireRole.js";

import {
  getForms,
  getFormById,
  createForm,
  archiveForm,
  formsPagination,
  submitFormBuilder,
  updateFormBuilder,
} from "../controllers/formsController.js";

const router = express.Router();

router.use(verifyJWT);

// Everyone reads forms (form-entry pages); only admins build them
router.get("/all", getForms);
router.get("/pagination", formsPagination);
router.get("/get/:id", getFormById);
router.post("/create", requireRole(...ADMINS), createForm);
router.post("/builder", requireRole(...ADMINS), submitFormBuilder);
router.put("/update/:id", requireRole(...ADMINS), updateFormBuilder);
// Archive only — forms are never hard-deleted (DELETE kept as an alias)
router.put("/archive/:id", requireRole(...ADMINS), archiveForm);
router.delete("/:id", requireRole(...ADMINS), archiveForm);

export default router;
