import express from "express";
import verifyJWT from "../middleware/verifyJWT.js";
import requireRole from "../middleware/requireRole.js";

import {
  usersPagination,
  createUser,
  getUserById,
  editUser,
  resetUserPassword,
  archiveUser,
} from "../controllers/usersController.js";
import { validate } from "../middleware/validate.js";
import {
  userSchema,
  adminResetPasswordSchema,
} from "../validation/schemas.js";

const router = express.Router();

router.use(verifyJWT);

// qfd_admin also needs the user list to pick approvers on the Forms page
router.get(
  "/pagination",
  requireRole("all_access", "qfd_admin"),
  usersPagination,
);

// User management itself is all_access only
router.post("/create", requireRole("all_access"), validate(userSchema), createUser);
router.get("/get/:id", requireRole("all_access"), getUserById);
router.put("/edit/:id", requireRole("all_access"), validate(userSchema), editUser);
router.put("/reset-password/:id", requireRole("all_access"), validate(adminResetPasswordSchema), resetUserPassword);
// Archive only — users are never deleted
router.put("/archive/:id", requireRole("all_access"), archiveUser);

export default router;
