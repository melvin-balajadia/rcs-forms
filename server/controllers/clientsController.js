import Clients from "../Models/Clients.js";
import { Op } from "sequelize";

export const getClients = async (req, res) => {
  try {
    const clients = await Clients.findAll();
    res.status(200).json(clients);
  } catch (error) {
    res.status(500).json({ message: "Error fetching clients", error });
  }
};

export const getClientsById = async (req, res) => {
  try {
    const clients = await Clients.findByPk(req.params.id);
    if (!clients) return res.status(404).json({ message: "Client not found" });

    res.status(200).json(clients);
  } catch (error) {
    res.status(500).json({ message: "Error fetching client", error });
  }
};

export const createClients = async (req, res) => {
  try {
    const { clients_name, clients_description, clients_site } = req.body;

    const allowedSites = [
      "Taytay",
      "Cabuyao",
      "Plaridel",
      "Marilao",
      "Villasis",
    ];
    if (!allowedSites.includes(clients_site)) {
      return res.status(400).json({
        message: `Invalid clients_site: must be one of ${allowedSites.join(
          ", "
        )}`,
      });
    }

    const newClient = await Clients.create({
      clients_name,
      clients_description,
      clients_site,
    });

    res
      .status(201)
      .json({ message: "Client created successfully", client: newClient });
  } catch (error) {
    res.status(500).json({ message: "Error creating client", error });
  }
};

export const updateClients = async (req, res) => {
  try {
    const { clients_name, clients_description, clients_site } = req.body;
    const client = await Clients.findByPk(req.params.id);
    if (!client) return res.status(404).json({ message: "Client not found" });

    if (clients_site) {
      const allowedSites = [
        "Taytay",
        "Cabuyao",
        "Plaridel",
        "Marilao",
        "Villasis",
      ];
      if (!allowedSites.includes(clients_site)) {
        return res.status(400).json({
          message: `Invalid clients_site: must be one of ${allowedSites.join(
            ", "
          )}`,
        });
      }
    }

    await client.update({ clients_name, clients_description, clients_site });
    res.status(200).json({ message: "Client updated successfully", client });
  } catch (error) {
    res.status(500).json({ message: "Error updating client", error });
  }
};

export const archiveClients = async (req, res) => {
  try {
    const client = await Clients.findByPk(req.params.id);
    if (!client) return res.status(404).json({ message: "Client not found" });

    await client.update({ clients_archivestatus: 1 });
    res.status(200).json({ message: "Client archived successfully", client });
  } catch (error) {
    res.status(500).json({ message: "Error archiving client", error });
  }
};

// Get Clients with Pagination and Filtering
export const clientsPagination = async (req, res) => {
  try {
    // Pagination Params
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 10;
    const offset = (page - 1) * pageSize;

    // Filter Params
    const { id, name, site, from, to } = req.query;
    const whereCondition = { clients_archivestatus: 0 };

    if (id) {
      whereCondition.clients_id = id;
    }

    if (name) {
      whereCondition.clients_name = { [Op.like]: `%${name}%` };
    }

    if (site) {
      whereCondition.clients_site = { [Op.like]: `%${site}%` };
    }

    if (from && to) {
      whereCondition.createdAt = { [Op.between]: [from, to] };
    }

    // Fetch paginated clients
    const { rows: clients, count } = await Clients.findAndCountAll({
      where: whereCondition,
      order: [["clients_id", "ASC"]],
      limit: pageSize,
      offset,
    });

    res.status(200).json({
      message: "Clients fetched successfully",
      total: count,
      totalPages: Math.ceil(count / pageSize),
      currentPage: page,
      pageSize,
      clients,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching paginated clients", error });
  }
};
