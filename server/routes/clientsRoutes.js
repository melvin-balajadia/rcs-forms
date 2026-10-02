import express from "express";
import verifyJWT from "../middleware/verifyJWT.js";
import requireRole, { ADMINS } from "../middleware/requireRole.js";

import {
  getClients,
  createClients,
  getClientsById,
  updateClients,
  archiveClients,
  clientsPagination,
} from "../controllers/clientsController.js";
import { validate } from "../middleware/validate.js";
import {
  clientSchema,
} from "../validation/schemas.js";

const router = express.Router();

// Clients page is admin-only
router.use(verifyJWT, requireRole(...ADMINS));

router.get("/all", getClients);
router.post("/create", validate(clientSchema), createClients);
router.get("/get/:id", getClientsById);
router.put("/update/:id", validate(clientSchema), updateClients);
router.put("/archive/:id", archiveClients);
router.get("/pagination", clientsPagination);

export default router;
