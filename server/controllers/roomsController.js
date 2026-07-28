import Rooms from "../Models/Rooms.js";

export const createRooms = async (req, res) => {
  try {
    const { room_name, room_description, room_site, room_location } = req.body;
    const newRoom = await Rooms.create({
      room_name,
      room_description,
      room_site,
      room_location,
    });

    res
      .status(201)
      .json({ message: "Room created successfully", room: newRoom });
  } catch (error) {
    res.status(500).json({ message: "Error creating room", error });
  }
};

export const getRooms = async (req, res) => {
  try {
    const rooms = await Rooms.findAll({
      where: {
        room_archivestatus: 0,
      },
    });
    res.status(200).json(rooms);
  } catch (error) {
    res.status(500).json({ message: "Error fetching rooms", error });
  }
};

export const getRoomsById = async (req, res) => {
  try {
    const room = await Rooms.findOne({
      where: {
        room_id: req.params.id,
        room_archivestatus: 0,
      },
    });
    if (!room) return res.status(404).json({ message: "Room not found" });

    res.status(200).json(room);
  } catch (error) {
    res.status(500).json({ message: "Error fetching room", error });
  }
};

export const updateRooms = async (req, res) => {
  try {
    const { room_name, room_description, room_site, room_location } = req.body;
    const room = await Rooms.findOne({
      where: {
        room_id: req.params.id,
        room_archivestatus: 0,
      },
    });
    if (!room) return res.status(404).json({ message: "Room not found" });

    await room.update({
      room_name,
      room_description,
      room_site,
      room_location,
    });
    res.status(200).json({ message: "Room updated successfully", room });
  } catch (error) {
    res.status(500).json({ message: "Error updating room", error });
  }
};

export const archiveRooms = async (req, res) => {
  try {
    const room = await Rooms.findOne({
      where: {
        room_id: req.params.id,
        room_archivestatus: 0,
      },
    });
    if (!room) return res.status(404).json({ message: "Room not found" });

    await room.update({ room_archivestatus: 1 });
    res.status(200).json({ message: "Room archived successfully", room });
  } catch (error) {
    res.status(500).json({ message: "Error archiving room", error });
  }
};

// Get Rooms with Pagination and Filtering
export const roomsPagination = async (req, res) => {
  try {
    // Pagination Params
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 10;
    const offset = (page - 1) * pageSize;

    // Filter Params
    const { id, name, site, location, from, to } = req.query;
    const whereCondition = { room_archivestatus: 0 }; // Only active rooms

    if (id) {
      whereCondition.room_id = id;
    }

    if (name) {
      whereCondition.room_name = { [Op.like]: `%${name}%` };
    }

    if (site) {
      whereCondition.room_site = { [Op.like]: `%${site}%` };
    }

    if (location) {
      whereCondition.room_location = { [Op.like]: `%${location}%` };
    }

    if (from && to) {
      whereCondition.createdAt = { [Op.between]: [from, to] };
    }

    // Fetch paginated rooms
    const { rows: rooms, count } = await Rooms.findAndCountAll({
      where: whereCondition,
      order: [["room_id", "ASC"]],
      limit: pageSize,
      offset,
    });

    res.status(200).json({
      message: "Rooms fetched successfully",
      total: count,
      totalPages: Math.ceil(count / pageSize),
      currentPage: page,
      pageSize,
      rooms,
    });
  } catch (error) {
    res.status(500).json({ message: "Error fetching paginated rooms", error });
  }
};
