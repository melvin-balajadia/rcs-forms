import express from "express";
import verifyJWT from "../middleware/verifyJWT.js";

import {
  createRooms,
  getRooms,
  getRoomsById,
  updateRooms,
  archiveRooms,
  roomsPagination,
} from "../controllers/roomsController.js";

const router = express.Router();

router.post("/create", verifyJWT, createRooms);
router.get("/all", verifyJWT, getRooms);
router.get("/get/:id", verifyJWT, getRoomsById);
router.put("/update/:id", verifyJWT, updateRooms);
router.put("/archive/:id", verifyJWT, archiveRooms);
router.get("/pagination", verifyJWT, roomsPagination);

export default router;
