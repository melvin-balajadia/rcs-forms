import express from "express";
import {
  getFormApproversByUser,
  updateUserFormApprovals,
  getApproversByForm,
  updateFormApprovers,
  checkUserCanApprove,
} from "../controllers/formApproversController.js";
import verifyJWT from "../middleware/verifyJWT.js";
import requireRole, { ADMINS, hasRole } from "../middleware/requireRole.js";

const router = express.Router();

router.use(verifyJWT);

// Users may look up their own assignments; admins may look up anyone's
const selfOrAdmin = (req, res, next) => {
  if (String(req.user.id) === req.params.userId || hasRole(req.user, ...ADMINS))
    return next();
  return requireRole(...ADMINS)(req, res, next);
};

router.get("/user/:userId", selfOrAdmin, getFormApproversByUser);
router.put("/user/:userId", requireRole("all_access"), updateUserFormApprovals);
router.get("/form/:formId", requireRole(...ADMINS), getApproversByForm);
router.put("/form/:formId", requireRole(...ADMINS), updateFormApprovers);
router.get(
  "/can-approve/:formEntryId/:userId",
  selfOrAdmin,
  checkUserCanApprove,
);

export default router;
