import express from "express";
import verifyJWT from "../middleware/verifyJWT.js";
import requireRole, { ADMINS } from "../middleware/requireRole.js";

import {
  createRooms,
  getRooms,
  getRoomsById,
  updateRooms,
  archiveRooms,
  roomsPagination,
} from "../controllers/roomsController.js";

const router = express.Router();

// Rooms page is admin-only
router.use(verifyJWT, requireRole(...ADMINS));

router.post("/create", createRooms);
router.get("/all", getRooms);
router.get("/get/:id", getRoomsById);
router.put("/update/:id", updateRooms);
router.put("/archive/:id", archiveRooms);
router.get("/pagination", roomsPagination);

export default router;
