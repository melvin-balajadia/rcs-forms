import express from "express";
import verifyJWT from "../middleware/verifyJWT.js";

import {
  login,
  refreshToken,
  logout,
  resetPassword,
} from "../controllers/userAuth.js";
import { validate } from "../middleware/validate.js";
import {
  loginSchema,
  resetPasswordSchema,
} from "../validation/schemas.js";

const router = express.Router();

router.post("/login", validate(loginSchema), login);
router.post("/refresh-token", refreshToken);
router.post("/logout", logout);
router.post("/reset-password", validate(resetPasswordSchema), resetPassword);

export default router;
