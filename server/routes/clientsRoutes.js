import express from "express";
import verifyJWT from "../middleware/verifyJWT.js";

import {
  getClients,
  createClients,
  getClientsById,
  updateClients,
  archiveClients,
  clientsPagination,
} from "../controllers/clientsController.js";

const router = express.Router();

router.get("/all", getClients);
router.post("/create", verifyJWT, createClients);
router.get("/get/:id", verifyJWT, getClientsById);
router.put("/update/:id", verifyJWT, updateClients);
router.put("/archive/:id", verifyJWT, archiveClients);
router.get("/pagination", verifyJWT, clientsPagination);

export default router;
