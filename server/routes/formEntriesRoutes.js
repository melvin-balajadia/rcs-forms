import express from "express";
import verifyJWT from "../middleware/verifyJWT.js";
import requireRole, { ADMINS, APPROVERS } from "../middleware/requireRole.js";
import {
  getFormEntries,
  getFormEntryById,
  archiveFormEntry,
  formEntriesPagination,
  createFormEntryBuilder,
  updateFormEntryBuilder,
  getQuestionValuesByEntryId,
  submitForApproval,
  approveFormEntry,
  getApprovalHistory,
  returnFormEntry,
} from "../controllers/formEntriesController.js";

const router = express.Router();

router.use(verifyJWT);

// Unscoped list of every entry — not used by the UI
router.get("/all", requireRole(...ADMINS), getFormEntries);

// Archive only — entries are never hard-deleted (DELETE kept as an alias)
router.put("/archive/:id", requireRole(...ADMINS), archiveFormEntry);
router.delete("/:id", requireRole(...ADMINS), archiveFormEntry);

router.get("/get/:id", getFormEntryById);
router.get("/pagination", formEntriesPagination);
router.post("/create-builder", createFormEntryBuilder);
router.post("/submit-approval", submitForApproval);
router.put("/update-builder/:entryId", updateFormEntryBuilder);
router.get("/entry/:entryId", getQuestionValuesByEntryId);
router.get("/:id/approval-history", getApprovalHistory);

// Requestors never approve or return entries
router.post("/approve", requireRole(...APPROVERS), approveFormEntry);
router.post("/return", requireRole(...APPROVERS), returnFormEntry);

export default router;
