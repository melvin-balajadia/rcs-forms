import { Op } from "sequelize";
import sequelize from "../utilities/db.js";
import FormEntries from "../Models/FormEntries.js";
import Forms from "../Models/Forms.js";
import Users from "../Models/Users.js";
import FormSection from "../Models/FormSection.js";
import Question from "../Models/Questions.js";
import FormQuestionValue from "../Models/FormQuestionValue.js";
import FormQuestionSubValue from "../Models/FormQuestionSubValue.js";
import SubQuestion from "../Models/SubQuestion.js";

const ANSWER_LABELS = { Y: "Yes", N: "No", NA: "N/A" };
const formatAnswer = (value) => ANSWER_LABELS[value] ?? value ?? "";

// ✅ Raw per-question answers for a set of entries — one row per
// (entry, question) pair, used for the Excel export's "Raw Answers" sheet
// so users can see exactly which entry/date had a given answer.
export const getRawAnswers = async (req, res) => {
  try {
    const { entry_ids } = req.body;

    if (!entry_ids || !Array.isArray(entry_ids) || entry_ids.length === 0) {
      return res.status(400).json({
        message: "entry_ids array is required and must not be empty",
      });
    }

    const values = await FormQuestionValue.findAll({
      where: { form_entry_id: { [Op.in]: entry_ids } },
      include: [
        {
          model: FormEntries,
          attributes: ["id", "form_entry_date", "form_entry_site", "form_entry_area"],
        },
        { model: Question, attributes: ["id", "form_questions", "question_type"] },
        { model: FormSection, attributes: ["form_section_id", "form_section_name"] },
        {
          model: FormQuestionSubValue,
          required: false,
          include: [
            { model: SubQuestion, attributes: ["sub_question_id", "sub_questions"] },
          ],
        },
      ],
      order: [
        ["form_entry_id", "ASC"],
        ["form_section_id", "ASC"],
        ["form_question_id", "ASC"],
      ],
    });

    const rows = [];

    for (const v of values) {
      const entry = v.FormEntry;
      const question = v.Question;
      const section = v.FormSection;

      rows.push({
        entry_id: v.form_entry_id,
        date: entry?.form_entry_date ?? null,
        site: entry?.form_entry_site ?? null,
        area: entry?.form_entry_area ?? null,
        section_name: section?.form_section_name ?? null,
        question_text: question?.form_questions ?? null,
        answer: formatAnswer(v.form_value),
        remarks: v.remarks ?? "",
        action_item: v.action_item ?? "",
      });

      for (const sv of v.FormQuestionSubValues ?? []) {
        rows.push({
          entry_id: v.form_entry_id,
          date: entry?.form_entry_date ?? null,
          site: entry?.form_entry_site ?? null,
          area: entry?.form_entry_area ?? null,
          section_name: section?.form_section_name ?? null,
          question_text: sv.SubQuestion?.sub_questions
            ? `${question?.form_questions ?? ""} > ${sv.SubQuestion.sub_questions}`
            : (question?.form_questions ?? null),
          answer: formatAnswer(sv.form_sub_value),
          remarks: sv.remarks ?? "",
          action_item: sv.action_item ?? "",
        });
      }
    }

    return res.status(200).json({
      message: "Raw answers retrieved successfully",
      data: rows,
    });
  } catch (error) {
    console.error("Error fetching raw answers:", error);
    return res.status(500).json({
      message: "Error fetching raw answers",
      error: error.message,
    });
  }
};

export const getFilterOptions = async (req, res) => {
  try {
    const forms = await Forms.findAll({
      attributes: ["id", "form_name"],
      order: [["form_name", "ASC"]],
    });

    const sites = await FormEntries.findAll({
      attributes: [
        [
          FormEntries.sequelize.fn(
            "DISTINCT",
            FormEntries.sequelize.col("form_entry_site"),
          ),
          "site",
        ],
      ],
      where: {
        form_entry_site: { [Op.ne]: null },
      },
      raw: true,
    });

    const areas = await FormEntries.findAll({
      attributes: [
        [
          FormEntries.sequelize.fn(
            "DISTINCT",
            FormEntries.sequelize.col("form_entry_area"),
          ),
          "area",
        ],
      ],
      where: {
        form_entry_area: { [Op.ne]: null },
      },
      raw: true,
    });

    const siteOptions = sites.map((s) => s.site).filter(Boolean);
    const areaOptions = areas.map((a) => a.area).filter(Boolean);

    return res.status(200).json({
      message: "Filter options retrieved successfully",
      data: {
        forms: forms.map((f) => ({
          value: f.id,
          label: f.form_name,
        })),
        sites: siteOptions.map((s) => ({
          value: s,
          label: s,
        })),
        areas: areaOptions.map((a) => ({
          value: a,
          label: a,
        })),
      },
    });
  } catch (error) {
    console.error("Error fetching filter options:", error);
    return res.status(500).json({
      message: "Error fetching filter options",
      error: error.message,
    });
  }
};

export const filterFormEntries = async (req, res) => {
  try {
    const { form_id, site, date_from, date_to, area } = req.body;

    if (!form_id) {
      return res.status(400).json({
        message: "Form type is required",
      });
    }

    if (!date_from || !date_to) {
      return res.status(400).json({
        message: "Date range (from and to) is required",
      });
    }

    if (new Date(date_from) > new Date(date_to)) {
      return res.status(400).json({
        message: "Date from cannot be later than date to",
      });
    }

    const whereConditions = {
      form_id: form_id,
      form_entry_date: {
        [Op.between]: [date_from, date_to],
      },
      form_entry_status: {
        [Op.in]: [
          "pending",
          "submitted_first",
          "submitted_second",
          "submitted_third",
          "completed",
        ],
      },
    };

    if (site) {
      whereConditions.form_entry_site = site;
    }

    if (area) {
      whereConditions.form_entry_area = area;
    }

    const formEntries = await FormEntries.findAll({
      where: whereConditions,
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
      order: [["form_entry_date", "DESC"]],
    });

    const formattedEntries = formEntries.map((entry) => ({
      entry_id: entry.id,
      user_id: entry.user_id,
      user_name: entry.User
        ? `${entry.User.user_firstname} ${entry.User.user_lastname}`.trim()
        : "Unknown User",
      user_email: entry.User?.user_email || "N/A",
      form_id: entry.form_id,
      form_name: entry.Form?.form_name || "Unknown Form",
      site: entry.form_entry_site || "N/A",
      area: entry.form_entry_area || "N/A",
      date: entry.form_entry_date,
      status: entry.form_entry_status,
      created_at: entry.createdAt,
    }));

    return res.status(200).json({
      message: "Form entries filtered successfully",
      count: formattedEntries.length,
      filters_applied: {
        form_id,
        site: site || "All",
        area: area || "All",
        date_from,
        date_to,
      },
      data: formattedEntries,
    });
  } catch (error) {
    console.error("Error filtering form entries:", error);
    return res.status(500).json({
      message: "Error filtering form entries",
      error: error.message,
    });
  }
};

export const getFilterStatistics = async (req, res) => {
  try {
    const { form_id, site, date_from, date_to, area } = req.query;

    if (!form_id || !date_from || !date_to) {
      return res.status(400).json({
        message: "form_id, date_from, and date_to are required",
      });
    }

    const whereConditions = {
      form_id: form_id,
      form_entry_date: {
        [Op.between]: [date_from, date_to],
      },
      form_entry_status: {
        [Op.in]: [
          "pending",
          "submitted_first",
          "submitted_second",
          "submitted_third",
          "completed",
        ],
      },
    };

    if (site) whereConditions.form_entry_site = site;
    if (area) whereConditions.form_entry_area = area;

    const totalCount = await FormEntries.count({
      where: whereConditions,
    });

    const statusCounts = await FormEntries.findAll({
      where: whereConditions,
      attributes: [
        "form_entry_status",
        [
          FormEntries.sequelize.fn("COUNT", FormEntries.sequelize.col("id")),
          "count",
        ],
      ],
      group: ["form_entry_status"],
      raw: true,
    });

    const siteCounts = await FormEntries.findAll({
      where: whereConditions,
      attributes: [
        "form_entry_site",
        [
          FormEntries.sequelize.fn("COUNT", FormEntries.sequelize.col("id")),
          "count",
        ],
      ],
      group: ["form_entry_site"],
      raw: true,
    });

    const areaCounts = await FormEntries.findAll({
      where: whereConditions,
      attributes: [
        "form_entry_area",
        [
          FormEntries.sequelize.fn("COUNT", FormEntries.sequelize.col("id")),
          "count",
        ],
      ],
      group: ["form_entry_area"],
      raw: true,
    });

    return res.status(200).json({
      message: "Statistics retrieved successfully",
      data: {
        total_entries: totalCount,
        by_status: statusCounts,
        by_site: siteCounts,
        by_area: areaCounts,
      },
    });
  } catch (error) {
    console.error("Error fetching statistics:", error);
    return res.status(500).json({
      message: "Error fetching statistics",
      error: error.message,
    });
  }
};

export const getFormSectionsWithMultiple = async (req, res) => {
  try {
    const { formId } = req.params;

    const sections = await FormSection.findAll({
      where: { form_id: formId },
      attributes: [
        "form_section_id",
        "form_section_name",
        "form_section_description",
      ],
    });

    if (sections.length === 0) {
      return res.status(200).json({
        message: "No sections found for this form",
        data: [],
      });
    }

    const formattedSections = [];

    for (const section of sections) {
      const questions = await Question.findAll({
        where: {
          form_section_id: section.form_section_id,
          question_type: "multiple",
        },
        attributes: ["id", "form_questions", "question_type"],
      });

      if (questions.length > 0) {
        formattedSections.push({
          section_id: section.form_section_id,
          section_name: section.form_section_name,
          section_description: section.form_section_description,
          question_count: questions.length,
        });
      }
    }

    return res.status(200).json({
      message: "Sections with multiple-type questions retrieved successfully",
      data: formattedSections,
    });
  } catch (error) {
    console.error("Error fetching sections:", error);
    return res.status(500).json({
      message: "Error fetching sections",
      error: error.message,
      details: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
};

export const generateOverallAverage = async (req, res) => {
  try {
    const { entry_ids, condition, section_id } = req.body;

    if (!entry_ids || !Array.isArray(entry_ids) || entry_ids.length === 0) {
      return res.status(400).json({
        message: "entry_ids array is required and must not be empty",
      });
    }

    if (!condition || !["Y", "N", "NA"].includes(condition)) {
      return res.status(400).json({
        message: "condition must be one of: Y, N, NA",
      });
    }

    const firstEntry = await FormEntries.findByPk(entry_ids[0]);
    if (!firstEntry) {
      return res.status(404).json({
        message: "Form entry not found",
      });
    }

    const formId = firstEntry.form_id;

    const whereConditions = {
      form_id: formId,
      question_type: "multiple",
    };

    if (section_id) {
      whereConditions.form_section_id = section_id;
    }

    const questions = await Question.findAll({
      where: whereConditions,
      attributes: ["id", "form_questions", "form_section_id"],
    });

    if (questions.length === 0) {
      return res.status(404).json({
        message: "No multiple-type questions found for this form/section",
      });
    }

    const questionIds = questions.map((q) => q.id);

    const answers = await FormQuestionValue.findAll({
      where: {
        form_entry_id: { [Op.in]: entry_ids },
        form_question_id: { [Op.in]: questionIds },
        form_value: { [Op.in]: ["Y", "N", "NA"] },
      },
      attributes: ["form_value"],
      raw: true,
    });

    const totalAnswers = answers.length;
    const yesCount = answers.filter((a) => a.form_value === "Y").length;
    const noCount = answers.filter((a) => a.form_value === "N").length;
    const naCount = answers.filter((a) => a.form_value === "NA").length;

    let conditionCount = 0;
    let conditionLabel = "";

    switch (condition) {
      case "Y":
        conditionCount = yesCount;
        conditionLabel = "Yes";
        break;
      case "N":
        conditionCount = noCount;
        conditionLabel = "No";
        break;
      case "NA":
        conditionCount = naCount;
        conditionLabel = "N/A";
        break;
    }

    const averagePercentage =
      totalAnswers > 0 ? ((conditionCount / totalAnswers) * 100).toFixed(2) : 0;

    const chartData = {
      chart_type: "overall",
      condition: condition,
      condition_label: conditionLabel,
      total_entries: entry_ids.length,
      total_questions: questions.length,
      total_answers: totalAnswers,
      breakdown: {
        yes: yesCount,
        no: noCount,
        na: naCount,
      },
      average_percentage: parseFloat(averagePercentage),
      section_info: section_id
        ? {
            section_id: section_id,
            section_name: questions[0]?.FormSection?.form_section_name || "N/A",
          }
        : null,
    };

    return res.status(200).json({
      message: "Overall average calculated successfully",
      data: chartData,
    });
  } catch (error) {
    console.error("Error generating overall average:", error);
    return res.status(500).json({
      message: "Error generating overall average",
      error: error.message,
    });
  }
};

export const generatePerSectionAverage = async (req, res) => {
  try {
    const { entry_ids, condition } = req.body;

    if (!entry_ids || !Array.isArray(entry_ids) || entry_ids.length === 0) {
      return res.status(400).json({
        message: "entry_ids array is required and must not be empty",
      });
    }

    if (!condition || !["Y", "N", "NA"].includes(condition)) {
      return res.status(400).json({
        message: "condition must be one of: Y, N, NA",
      });
    }

    const firstEntry = await FormEntries.findByPk(entry_ids[0]);
    if (!firstEntry) {
      return res.status(404).json({
        message: "Form entry not found",
      });
    }

    const formId = firstEntry.form_id;

    const sections = await FormSection.findAll({
      where: { form_id: formId },
      attributes: ["form_section_id", "form_section_name"],
    });

    const sectionResults = [];

    for (const section of sections) {
      const questions = await Question.findAll({
        where: {
          form_section_id: section.form_section_id,
          [Op.or]: [
            sequelize.where(
              sequelize.fn("LOWER", sequelize.col("question_type")),
              "multiple",
            ),
            { question_type: "multiple" },
          ],
        },
        attributes: ["id"],
      });

      if (questions.length === 0) continue;

      const questionIds = questions.map((q) => q.id);

      const answers = await FormQuestionValue.findAll({
        where: {
          form_entry_id: { [Op.in]: entry_ids },
          form_question_id: { [Op.in]: questionIds },
          form_value: { [Op.in]: ["Y", "N", "NA"] },
        },
        attributes: ["form_value"],
        raw: true,
      });

      const totalAnswers = answers.length;
      if (totalAnswers === 0) continue;

      const yesCount = answers.filter((a) => a.form_value === "Y").length;
      const noCount = answers.filter((a) => a.form_value === "N").length;
      const naCount = answers.filter((a) => a.form_value === "NA").length;

      let conditionCount = 0;
      switch (condition) {
        case "Y":
          conditionCount = yesCount;
          break;
        case "N":
          conditionCount = noCount;
          break;
        case "NA":
          conditionCount = naCount;
          break;
      }

      const averagePercentage =
        totalAnswers > 0
          ? ((conditionCount / totalAnswers) * 100).toFixed(2)
          : 0;

      sectionResults.push({
        section_id: section.form_section_id,
        section_name: section.form_section_name,
        total_questions: questionIds.length,
        total_answers: totalAnswers,
        breakdown: {
          yes: yesCount,
          no: noCount,
          na: naCount,
        },
        average_percentage: parseFloat(averagePercentage),
      });
    }

    const overallAverage =
      sectionResults.length > 0
        ? (
            sectionResults.reduce((sum, s) => sum + s.average_percentage, 0) /
            sectionResults.length
          ).toFixed(2)
        : 0;

    const conditionLabels = { Y: "Yes", N: "No", NA: "N/A" };

    const chartData = {
      chart_type: "per_section",
      condition: condition,
      condition_label: conditionLabels[condition],
      total_entries: entry_ids.length,
      sections: sectionResults,
      overall_average: parseFloat(overallAverage),
    };

    return res.status(200).json({
      message: "Per-section averages calculated successfully",
      data: chartData,
    });
  } catch (error) {
    console.error("Error generating per-section average:", error);
    return res.status(500).json({
      message: "Error generating per-section average",
      error: error.message,
    });
  }
};

export const generatePerQuestionAverage = async (req, res) => {
  try {
    const { entry_ids, condition, section_id } = req.body;

    if (!entry_ids || !Array.isArray(entry_ids) || entry_ids.length === 0) {
      return res.status(400).json({
        message: "entry_ids array is required and must not be empty",
      });
    }

    if (!condition || !["Y", "N", "NA"].includes(condition)) {
      return res.status(400).json({
        message: "condition must be one of: Y, N, NA",
      });
    }

    const firstEntry = await FormEntries.findByPk(entry_ids[0]);
    if (!firstEntry) {
      return res.status(404).json({
        message: "Form entry not found",
      });
    }

    const formId = firstEntry.form_id;

    const sectionFilter = { form_id: formId };
    if (section_id) {
      sectionFilter.form_section_id = section_id;
    }

    const sections = await FormSection.findAll({
      where: sectionFilter,
      attributes: ["form_section_id", "form_section_name"],
      order: [["form_section_id", "ASC"]],
    });

    const sectionResults = [];

    for (const section of sections) {
      const questions = await Question.findAll({
        where: {
          form_section_id: section.form_section_id,
          [Op.or]: [
            sequelize.where(
              sequelize.fn("LOWER", sequelize.col("question_type")),
              "multiple",
            ),
            { question_type: "multiple" },
          ],
        },
        attributes: ["id", "form_questions"],
        order: [["id", "ASC"]],
      });

      if (questions.length === 0) continue;

      const questionResults = [];

      for (const question of questions) {
        const answers = await FormQuestionValue.findAll({
          where: {
            form_entry_id: { [Op.in]: entry_ids },
            form_question_id: question.id,
            form_value: { [Op.in]: ["Y", "N", "NA"] },
          },
          attributes: ["form_value"],
          raw: true,
        });

        const totalAnswers = answers.length;
        if (totalAnswers === 0) continue;

        const yesCount = answers.filter((a) => a.form_value === "Y").length;
        const noCount = answers.filter((a) => a.form_value === "N").length;
        const naCount = answers.filter((a) => a.form_value === "NA").length;

        let conditionCount = 0;
        switch (condition) {
          case "Y":
            conditionCount = yesCount;
            break;
          case "N":
            conditionCount = noCount;
            break;
          case "NA":
            conditionCount = naCount;
            break;
        }

        const averagePercentage =
          totalAnswers > 0
            ? ((conditionCount / totalAnswers) * 100).toFixed(2)
            : 0;

        questionResults.push({
          question_id: question.id,
          question_text: question.form_questions,
          total_answers: totalAnswers,
          breakdown: {
            yes: yesCount,
            no: noCount,
            na: naCount,
          },
          average_percentage: parseFloat(averagePercentage),
        });
      }

      if (questionResults.length > 0) {
        sectionResults.push({
          section_id: section.form_section_id,
          section_name: section.form_section_name,
          questions: questionResults,
        });
      }
    }

    const conditionLabels = { Y: "Yes", N: "No", NA: "N/A" };

    const chartData = {
      chart_type: "per_question",
      condition: condition,
      condition_label: conditionLabels[condition],
      total_entries: entry_ids.length,
      sections: sectionResults,
    };

    return res.status(200).json({
      message: "Per-question averages calculated successfully",
      data: chartData,
    });
  } catch (error) {
    console.error("Error generating per-question average:", error);
    return res.status(500).json({
      message: "Error generating per-question average",
      error: error.message,
    });
  }
};
