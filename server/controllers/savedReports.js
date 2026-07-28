import { Op } from "sequelize";
import SavedReport from "../Models/Reports.js";
import SavedReportData from "../Models/ReportsData.js";
import User from "../Models/Users.js";
import Form from "../Models/Forms.js";
import FormSection from "../Models/FormSection.js";

export const saveReport = async (req, res) => {
  try {
    const {
      user_id,
      report_name,
      report_description,
      form_id,
      filter_site,
      filter_area,
      filter_date_from,
      filter_date_to,
      entries_count,
      entry_ids,
      chart_type,
      chart_condition,
      chart_section_id,
      snapshot_overall_average,
      snapshot_yes_total,
      snapshot_no_total,
      snapshot_na_total,
      snapshot_total_answers,
      detailed_snapshot,
    } = req.body;

    // Validation
    if (!report_name || !form_id || !chart_type || !chart_condition) {
      return res.status(400).json({
        message:
          "Missing required fields: report_name, form_id, chart_type, chart_condition",
      });
    }

    if (!entry_ids || !Array.isArray(entry_ids) || entry_ids.length === 0) {
      return res.status(400).json({
        message: "entry_ids must be a non-empty array",
      });
    }

    // Create saved report
    const savedReport = await SavedReport.create({
      created_by: user_id,
      report_name,
      report_description: report_description || null,
      form_id,
      filter_site: filter_site || null,
      filter_area: filter_area || null,
      filter_date_from,
      filter_date_to,
      entries_count: entries_count || entry_ids.length,
      entry_ids,
      chart_type,
      chart_condition,
      chart_section_id: chart_section_id || null,
      snapshot_overall_average: snapshot_overall_average || null,
      snapshot_yes_total: snapshot_yes_total || null,
      snapshot_no_total: snapshot_no_total || null,
      snapshot_na_total: snapshot_na_total || null,
      snapshot_total_answers: snapshot_total_answers || null,
    });

    // If detailed snapshot provided, save it
    if (detailed_snapshot && Array.isArray(detailed_snapshot)) {
      const reportDataRecords = detailed_snapshot.map((item) => ({
        saved_report_id: savedReport.id,
        data_type: item.data_type,
        section_id: item.section_id || null,
        question_id: item.question_id || null,
        section_name: item.section_name || null,
        question_text: item.question_text || null,
        total_questions: item.total_questions || null,
        total_answers: item.total_answers,
        yes_count: item.yes_count,
        no_count: item.no_count,
        na_count: item.na_count,
        average_percentage: item.average_percentage,
      }));

      await SavedReportData.bulkCreate(reportDataRecords);
    }

    return res.status(201).json({
      message: "Report saved successfully",
      data: {
        id: savedReport.id,
        report_name: savedReport.report_name,
      },
    });
  } catch (error) {
    console.error("Error saving report:", error);
    return res.status(500).json({
      message: "Error saving report",
      error: error.message,
    });
  }
};

/**
 * Get all saved reports for current user
 */
export const getMySavedReports = async (req, res) => {
  try {
    const reports = await SavedReport.findAll({
      where: {
        is_archived: false,
      },
      include: [
        {
          model: Form,
          as: "form",
          attributes: ["id", "form_name"],
        },
        {
          model: FormSection,
          as: "chart_section",
          attributes: ["form_section_id", "form_section_name"],
          required: false,
        },
      ],
      attributes: [
        "id",
        "report_name",
        "report_description",
        "form_id",
        "filter_site",
        "filter_area",
        "filter_date_from",
        "filter_date_to",
        "entries_count",
        "chart_type",
        "chart_condition",
        "snapshot_overall_average",
        "createdAt",
        "last_viewed_at",
      ],
      order: [["createdAt", "DESC"]],
    });

    return res.status(200).json({
      message: "Saved reports retrieved successfully",
      data: reports,
    });
  } catch (error) {
    console.error("Error fetching saved reports:", error);
    return res.status(500).json({
      message: "Error fetching saved reports",
      error: error.message,
    });
  }
};

/**
 * Get a specific saved report by ID
 */
export const getSavedReportById = async (req, res) => {
  try {
    const { reportId } = req.params;

    const report = await SavedReport.findOne({
      where: {
        id: reportId,
      },
      include: [
        {
          model: Form,
          as: "form",
          attributes: ["id", "form_name"],
        },
        {
          model: FormSection,
          as: "chart_section",
          attributes: ["form_section_id", "form_section_name"],
          required: false,
        },
        {
          model: SavedReportData,
          as: "report_data",
          required: false,
        },
        {
          model: User,
          as: "creator",
          attributes: ["id", "user_firstname", "user_lastname", "user_email"],
        },
      ],
    });

    if (!report) {
      return res.status(404).json({
        message: "Report not found",
      });
    }

    await report.update({ last_viewed_at: new Date() });

    return res.status(200).json({
      message: "Report retrieved successfully",
      data: report,
    });
  } catch (error) {
    console.error("Error fetching report:", error);
    return res.status(500).json({
      message: "Error fetching report",
      error: error.message,
    });
  }
};

/**
 * Update a saved report (name/description only)
 */
export const updateSavedReport = async (req, res) => {
  try {
    const { reportId } = req.params;
    const { userId } = req;
    const { report_name, report_description } = req.body;

    const report = await SavedReport.findOne({
      where: {
        id: reportId,
        created_by: userId,
      },
    });

    if (!report) {
      return res.status(404).json({
        message: "Report not found or you don't have permission to edit it",
      });
    }

    await report.update({
      report_name: report_name || report.report_name,
      report_description:
        report_description !== undefined
          ? report_description
          : report.report_description,
    });

    return res.status(200).json({
      message: "Report updated successfully",
      data: report,
    });
  } catch (error) {
    console.error("Error updating report:", error);
    return res.status(500).json({
      message: "Error updating report",
      error: error.message,
    });
  }
};

/**
 * Delete a saved report
 */
export const deleteSavedReport = async (req, res) => {
  try {
    const { reportId } = req.params;
    const { userId } = req;

    const report = await SavedReport.findOne({
      where: {
        id: reportId,
        created_by: userId,
      },
    });

    if (!report) {
      return res.status(404).json({
        message: "Report not found or you don't have permission to delete it",
      });
    }

    // Soft delete
    await report.update({ is_archived: true });

    // Or hard delete (if you prefer)
    // await report.destroy();

    return res.status(200).json({
      message: "Report deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting report:", error);
    return res.status(500).json({
      message: "Error deleting report",
      error: error.message,
    });
  }
};

/**
 * Refresh a saved report (regenerate with current data)
 */
export const refreshSavedReport = async (req, res) => {
  try {
    const { reportId } = req.params;
    const { userId } = req;

    const report = await SavedReport.findOne({
      where: {
        id: reportId,
        created_by: userId,
      },
    });

    if (!report) {
      return res.status(404).json({
        message: "Report not found or you don't have permission to refresh it",
      });
    }

    // Return the configuration so frontend can regenerate
    return res.status(200).json({
      message: "Report configuration retrieved for refresh",
      data: {
        form_id: report.form_id,
        filter_site: report.filter_site,
        filter_area: report.filter_area,
        filter_date_from: report.filter_date_from,
        filter_date_to: report.filter_date_to,
        chart_type: report.chart_type,
        chart_condition: report.chart_condition,
        chart_section_id: report.chart_section_id,
        entry_ids: report.entry_ids,
      },
    });
  } catch (error) {
    console.error("Error refreshing report:", error);
    return res.status(500).json({
      message: "Error refreshing report",
      error: error.message,
    });
  }
};
