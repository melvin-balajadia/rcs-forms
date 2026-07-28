import express from "express";
import {
  getFormApproversByUser,
  updateUserFormApprovals,
  getApproversByForm,
  updateFormApprovers,
  checkUserCanApprove,
} from "../controllers/formApproversController.js";
import veriftJWT from "../middleware/verifyJWT.js";

const router = express.Router();

router.get("/user/:userId", veriftJWT, getFormApproversByUser);
router.put("/user/:userId", veriftJWT, updateUserFormApprovals);
router.get("/form/:formId", veriftJWT, getApproversByForm);
router.put("/form/:formId", veriftJWT, updateFormApprovers);
router.get("/can-approve/:formEntryId/:userId", veriftJWT, checkUserCanApprove);

export default router;
