import express from "express";
import verifyJWT from "../middleware/verifyJWT.js";
import {
  getFormEntries,
  getFormEntryById,
  deleteFormEntry,
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

router.get("/all", verifyJWT, getFormEntries);
router.get("/get/:id", verifyJWT, getFormEntryById);
router.delete("/:id", verifyJWT, deleteFormEntry);
router.get("/pagination", verifyJWT, formEntriesPagination);
router.post("/create-builder", verifyJWT, createFormEntryBuilder);
router.post("/submit-approval", verifyJWT, submitForApproval);
router.post("/approve", verifyJWT, approveFormEntry);
router.put("/update-builder/:entryId", verifyJWT, updateFormEntryBuilder);
router.get("/entry/:entryId", verifyJWT, getQuestionValuesByEntryId);
router.get("/:id/approval-history", verifyJWT, getApprovalHistory);
router.post("/return", verifyJWT, returnFormEntry);

export default router;
