import express from "express";
import verifyJWT from "../middleware/verifyJWT.js";

import {
  usersPagination,
  createUser,
  getUserById,
  editUser,
  resetUserPassword,
} from "../controllers/usersController.js";

const router = express.Router();

router.get("/pagination", verifyJWT, usersPagination);
router.post("/create", verifyJWT, createUser);
router.get("/get/:id", verifyJWT, getUserById);
router.put("/edit/:id", verifyJWT, editUser);
router.put("/reset-password/:id", verifyJWT, resetUserPassword);

export default router;
