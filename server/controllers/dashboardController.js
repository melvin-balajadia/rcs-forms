import FormEntries from "../Models/FormEntries.js";
import Users from "../Models/Users.js";
import Forms from "../Models/Forms.js";
import { Op } from "sequelize";
import { getFormEntryVisibility } from "../utilities/formEntryVisibility.js";

export const getKeyMetrics = async (req, res) => {
  try {
    const totalEntries = await FormEntries.count();

    const pendingApproval = await FormEntries.count({
      where: {
        form_entry_status: {
          [Op.in]: [
            "submitted_first",
            "approved_first",
            "submitted_second",
            "approved_second",
            "submitted_third",
          ],
        },
      },
    });

    const completed = await FormEntries.count({
      where: { form_entry_status: "completed" },
    });

    return res.status(200).json({
      totalEntries,
      pendingApproval,
      completed,
    });
  } catch (error) {
    console.error("Error fetching key metrics:", error);
    return res.status(500).json({
      message: "Error fetching key metrics",
      error: error.message,
    });
  }
};

export const getSystemOverview = async (req, res) => {
  try {
    const totalUsers = await Users.count();

    const activeSites = await FormEntries.count({
      distinct: true,
      col: "form_entry_site",
      where: {
        form_entry_site: { [Op.ne]: null },
      },
    });

    return res.status(200).json({
      totalUsers,
      activeSites,
    });
  } catch (error) {
    console.error("Error fetching system overview:", error);
    return res.status(500).json({
      message: "Error fetching system overview",
      error: error.message,
    });
  }
};

export const getRecentEntries = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;

    // ✅ Same visibility scope as the Form Entries list: requestors only
    // see their own, approvers also see entries for forms they're assigned
    // to, all_access/qfd_admin see everything.
    const { currentUser, condition } = await getFormEntryVisibility(req);
    if (!currentUser) {
      return res.status(401).json({ message: "Invalid session" });
    }

    const recentEntries = await FormEntries.findAll({
      where: condition || undefined,
      limit,
      order: [["createdAt", "DESC"]],
      include: [
        {
          model: Forms,
          attributes: ["id", "form_name"],
        },
        {
          model: Users,
          attributes: ["id", "user_firstname", "user_lastname", "user_email"],
        },
      ],
      attributes: [
        "id",
        "form_entry_status",
        "form_entry_site",
        "form_entry_area",
        "form_entry_date",
        "createdAt",
      ],
    });

    const formatted = recentEntries.map((entry) => ({
      id: entry.id,
      formName: entry.Form?.form_name || "Unknown Form",
      status: entry.form_entry_status,
      site: entry.form_entry_site,
      area: entry.form_entry_area,
      date: entry.form_entry_date,
      createdBy: entry.User
        ? `${entry.User.user_firstname} ${entry.User.user_lastname}`
        : "Unknown User",
      createdAt: entry.createdAt,
    }));

    return res.status(200).json(formatted);
  } catch (error) {
    console.error("Error fetching recent entries:", error);
    return res.status(500).json({
      message: "Error fetching recent entries",
      error: error.message,
    });
  }
};

const AWAITING_APPROVAL_STATUSES = [
  "submitted_first",
  "approved_first",
  "submitted_second",
  "approved_second",
  "submitted_third",
];

export const getAllDashboardData = async (req, res) => {
  try {
    // ✅ Same visibility scope as the Form Entries list: requestors only see
    // their own, approvers also see entries for forms they're assigned to,
    // all_access/qfd_admin see everything.
    const { currentUser, isAdmin, condition } =
      await getFormEntryVisibility(req);
    if (!currentUser) {
      return res.status(401).json({ message: "Invalid session" });
    }

    const roles = Array.isArray(currentUser.user_groups)
      ? currentUser.user_groups
      : [];
    const isApprover = roles.includes("approver");
    // Pure requestor: no approver/admin capability, gets personal counts.
    const viewMode = isAdmin || isApprover ? "org" : "requestor";

    let keyMetricsPromise;
    if (viewMode === "org") {
      // ✅ Admins see true org-wide counts; plain approvers see counts
      // scoped to the same visibility rule as their entry list (their own
      // entries + forms they're assigned to approve).
      const scopeWhere = condition || undefined;
      keyMetricsPromise = Promise.all([
        FormEntries.count({ where: scopeWhere }),
        FormEntries.count({
          where: {
            ...(scopeWhere ? { [Op.and]: [scopeWhere] } : {}),
            form_entry_status: { [Op.in]: AWAITING_APPROVAL_STATUSES },
          },
        }),
        FormEntries.count({
          where: {
            ...(scopeWhere ? { [Op.and]: [scopeWhere] } : {}),
            form_entry_status: "completed",
          },
        }),
        FormEntries.count({
          where: {
            ...(scopeWhere ? { [Op.and]: [scopeWhere] } : {}),
            form_entry_status: "returned",
          },
        }),
      ]).then(([totalFormEntries, pendingApproval, completed, returned]) => ({
        totalFormEntries,
        pendingApproval,
        completed,
        returned,
      }));
    } else {
      keyMetricsPromise = Promise.all([
        FormEntries.count({
          where: { user_id: currentUser.id, form_entry_status: "draft" },
        }),
        FormEntries.count({
          where: {
            user_id: currentUser.id,
            form_entry_status: { [Op.in]: AWAITING_APPROVAL_STATUSES },
          },
        }),
        FormEntries.count({
          where: { user_id: currentUser.id, form_entry_status: "returned" },
        }),
        FormEntries.count({
          where: { user_id: currentUser.id, form_entry_status: "completed" },
        }),
      ]).then(([myDrafts, myAwaitingApproval, myReturned, myCompleted]) => ({
        myDrafts,
        myAwaitingApproval,
        myReturned,
        myCompleted,
      }));
    }

    const [keyMetrics, recentEntries] = await Promise.all([
      keyMetricsPromise,

      // Recent entries
      FormEntries.findAll({
        where: condition || undefined,
        limit: 10,
        order: [["createdAt", "DESC"]],
        include: [
          { model: Forms, attributes: ["id", "form_name"] },
          {
            model: Users,
            attributes: ["id", "user_firstname", "user_lastname"],
          },
        ],
        attributes: ["id", "form_entry_status", "form_entry_site", "createdAt"],
      }),
    ]);

    return res.status(200).json({
      viewMode,
      keyMetrics,
      recentEntries: recentEntries.map((entry) => ({
        id: entry.id,
        formName: entry.Form?.form_name || "Unknown Form",
        status: entry.form_entry_status,
        site: entry.form_entry_site,
        createdBy: entry.User
          ? `${entry.User.user_firstname} ${entry.User.user_lastname}`
          : "Unknown User",
        createdAt: entry.createdAt,
      })),
    });
  } catch (error) {
    console.error("Error fetching dashboard data:", error);
    return res.status(500).json({
      message: "Error fetching dashboard data",
      error: error.message,
    });
  }
};
