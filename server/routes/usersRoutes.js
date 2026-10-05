import express from "express";
import verifyJWT from "../middleware/verifyJWT.js";
import requireRole from "../middleware/requireRole.js";

import {
  usersPagination,
  createUser,
  getUserById,
  editUser,
  resetUserPassword,
} from "../controllers/usersController.js";

const router = express.Router();

router.use(verifyJWT);

// qfd_admin also needs the user list to pick approvers on the Forms page
router.get(
  "/pagination",
  requireRole("all_access", "qfd_admin"),
  usersPagination,
);

// User management itself is all_access only
router.post("/create", requireRole("all_access"), createUser);
router.get("/get/:id", requireRole("all_access"), getUserById);
router.put("/edit/:id", requireRole("all_access"), editUser);
router.put("/reset-password/:id", requireRole("all_access"), resetUserPassword);

export default router;
