import Users from "../Models/Users.js";
import bcrypt from "bcrypt";
import { Op } from "sequelize";

export const createUser = async (req, res) => {
  try {
    const {
      user_firstname,
      user_middlename,
      user_lastname,
      user_email,
      user_contact,
      user_address,
      user_groups,
      user_department,
      user_site,
      user_username,
      user_password,
    } = req.body;

    if (!user_username || !user_password) {
      return res.status(400).json({
        ErrorMessage: "Username or Password cannot be empty!",
        ErrorState: true,
      });
    }

    if (
      !user_groups ||
      !Array.isArray(user_groups) ||
      user_groups.length === 0
    ) {
      return res.status(400).json({
        ErrorMessage: "User must have at least one role!",
        ErrorState: true,
      });
    }

    const validRoles = ["requestor", "approver", "all_access", "qfd_admin"];

    const invalidRoles = user_groups.filter(
      (role) => !validRoles.includes(role),
    );
    if (invalidRoles.length > 0) {
      return res.status(400).json({
        ErrorMessage: `Invalid roles: ${invalidRoles.join(", ")}. Valid roles are: ${validRoles.join(", ")}`,
        ErrorState: true,
      });
    }

    const hasRequestor = user_groups.includes("requestor");
    const hasApprover = user_groups.includes("approver");
    const hasAllAccess = user_groups.includes("all_access");
    const hasQfdAdmin = user_groups.includes("qfd_admin");

    if (hasAllAccess && user_groups.length > 1) {
      return res.status(400).json({
        ErrorMessage: "all_access cannot be combined with other roles.",
        ErrorState: true,
      });
    }

    if (hasQfdAdmin && user_groups.length > 1) {
      return res.status(400).json({
        ErrorMessage: "qfd_admin cannot be combined with other roles.",
        ErrorState: true,
      });
    }

    if (hasRequestor && hasApprover) {
      return res.status(400).json({
        ErrorMessage: "A requestor cannot also be an approver.",
        ErrorState: true,
      });
    }

    if (hasRequestor && user_groups.length > 1) {
      return res.status(400).json({
        ErrorMessage: "Requestor must be a single role.",
        ErrorState: true,
      });
    }

    const existingUser = await Users.findOne({ where: { user_username } });
    if (existingUser) {
      return res.status(400).json({
        ErrorMessage: "Username is already used.",
        ErrorState: true,
      });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(user_password, salt);

    await Users.create({
      user_firstname,
      user_middlename,
      user_lastname,
      user_email,
      user_contact,
      user_address,
      user_groups,
      user_department,
      user_site,
      user_username,
      user_password: hashedPassword,
    });

    return res.status(201).json({
      ErrorMessage: "User has been added successfully.",
      ErrorState: false,
    });
  } catch (err) {
    console.error("Backend error:", err);
    return res.status(500).json({
      ErrorMessage:
        "Unable to process your request. Contact your administrator.",
      ErrorState: true,
    });
  }
};

export const editUser = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      user_firstname,
      user_middlename,
      user_lastname,
      user_email,
      user_contact,
      user_address,
      user_groups,
      user_department,
      user_site,
      user_username,
      user_password,
    } = req.body;

    const user = await Users.findByPk(id);
    if (!user) {
      return res.status(404).json({
        ErrorMessage: "User not found.",
        ErrorState: true,
      });
    }

    if (user_groups) {
      if (!Array.isArray(user_groups) || user_groups.length === 0) {
        return res.status(400).json({
          ErrorMessage: "User must have at least one role!",
          ErrorState: true,
        });
      }

      const validRoles = ["requestor", "approver", "all_access", "qfd_admin"];

      const invalidRoles = user_groups.filter(
        (role) => !validRoles.includes(role),
      );
      if (invalidRoles.length > 0) {
        return res.status(400).json({
          ErrorMessage: `Invalid roles: ${invalidRoles.join(", ")}`,
          ErrorState: true,
        });
      }

      const hasRequestor = user_groups.includes("requestor");
      const hasApprover = user_groups.includes("approver");
      const hasAllAccess = user_groups.includes("all_access");
      const hasQfdAdmin = user_groups.includes("qfd_admin");

      if (hasAllAccess && user_groups.length > 1) {
        return res.status(400).json({
          ErrorMessage: "all_access cannot be combined with other roles.",
          ErrorState: true,
        });
      }

      if (hasQfdAdmin && user_groups.length > 1) {
        return res.status(400).json({
          ErrorMessage: "qfd_admin cannot be combined with other roles.",
          ErrorState: true,
        });
      }

      if (hasRequestor && hasApprover) {
        return res.status(400).json({
          ErrorMessage: "A requestor cannot also be an approver.",
          ErrorState: true,
        });
      }

      if (hasRequestor && user_groups.length > 1) {
        return res.status(400).json({
          ErrorMessage: "Requestor must be a single role.",
          ErrorState: true,
        });
      }
    }

    if (user_username) {
      const existingUser = await Users.findOne({
        where: { user_username, id: { [Op.ne]: id } },
      });
      if (existingUser) {
        return res.status(400).json({
          ErrorMessage: "Username is already used by another account.",
          ErrorState: true,
        });
      }
    }

    const updateData = {
      user_firstname,
      user_middlename,
      user_lastname,
      user_email,
      user_contact,
      user_address,
      user_groups,
      user_department,
      user_site,
      user_username,
    };

    if (user_password && user_password.trim() !== "") {
      const salt = await bcrypt.genSalt(10);
      updateData.user_password = await bcrypt.hash(user_password, salt);
      updateData.user_reset_token = false;
    }

    await user.update(updateData);

    return res.status(200).json({
      ErrorMessage: "User has been updated successfully.",
      ErrorState: false,
    });
  } catch (err) {
    console.error("Backend error:", err);
    return res.status(500).json({
      ErrorMessage:
        "Unable to process your request. Contact your administrator.",
      ErrorState: true,
    });
  }
};

export const resetUserPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { password } = req.body;

    if (!password || password.trim() === "") {
      return res.status(400).json({
        ErrorMessage: "Password cannot be empty!",
        ErrorState: true,
      });
    }

    const passwordRegex = /^(?=.*[A-Z])(?=.*[0-9])(?=.*[^a-zA-Z0-9]).{8,}$/;
    if (!passwordRegex.test(password)) {
      return res.status(400).json({
        ErrorMessage:
          "Password must be at least 8 characters and include an uppercase letter, a number, and a special character.",
        ErrorState: true,
      });
    }

    const user = await Users.findByPk(id);
    if (!user) {
      return res.status(404).json({
        ErrorMessage: "User not found.",
        ErrorState: true,
      });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    await user.update({
      user_password: hashedPassword,
      user_reset_token: false,
    });

    return res.status(200).json({
      ErrorMessage: "Password has been reset successfully.",
      ErrorState: false,
    });
  } catch (err) {
    console.error("Backend error:", err);
    return res.status(500).json({
      ErrorMessage:
        "Unable to process your request. Contact your administrator.",
      ErrorState: true,
    });
  }
};

export const getUserById = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await Users.findByPk(id);

    if (!user) {
      return res.status(404).json({
        ErrorMessage: "User not found.",
        ErrorState: true,
      });
    }

    return res.status(200).json({
      ErrorMessage: "User fetched successfully.",
      ErrorState: false,
      data: user,
    });
  } catch (err) {
    console.error("Backend error:", err);
    return res.status(500).json({
      ErrorMessage:
        "Unable to process your request. Contact your administrator.",
      ErrorState: true,
    });
  }
};

export const usersPagination = async (req, res) => {
  try {
    // Pagination Params
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 10;
    const offset = (page - 1) * pageSize;

    // Filter Params
    const {
      user_id,
      user_firstname,
      user_lastname,
      user_email,
      user_department,
      user_site,
    } = req.query;
    const whereCondition = {};

    if (user_id) {
      whereCondition.user_id = user_id;
    }

    if (user_firstname) {
      whereCondition.user_firstname = { [Op.like]: `%${user_firstname}%` };
    }

    if (user_lastname) {
      whereCondition.user_lastname = { [Op.like]: `%${user_lastname}%` };
    }

    if (user_email) {
      whereCondition.user_email = { [Op.like]: `%${user_email}%` };
    }

    if (user_department) {
      whereCondition.user_department = { [Op.like]: `%${user_department}%` };
    }

    if (user_site) {
      whereCondition.user_site = { [Op.like]: `%${user_site}%` };
    }

    // Fetch paginated data
    const { rows: users, count } = await Users.findAndCountAll({
      where: whereCondition,
      attributes: [
        "id",
        "user_firstname",
        "user_middlename",
        "user_lastname",
        "user_email",
        "user_contact",
        "user_groups",
        "user_department",
        "user_site",
        "user_username",
      ], // Exclude password
      order: [["id", "ASC"]],
      limit: pageSize,
      offset,
    });

    res.status(200).json({
      message: "Users fetched successfully",
      total: count,
      totalPages: Math.ceil(count / pageSize),
      currentPage: page,
      pageSize,
      data: users,
    });
  } catch (error) {
    res.status(500).json({ message: "Error fetching paginated users", error });
  }
};
