import express from "express";
import verifyJWT from "../middleware/verifyJWT.js";

import {
  login,
  refreshToken,
  logout,
  resetPassword,
} from "../controllers/userAuth.js";

const router = express.Router();

router.post("/login", login);
router.post("/refresh-token", refreshToken);
router.post("/logout", logout);
router.post("/reset-password", resetPassword);

export default router;
