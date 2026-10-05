// Form endpoints. Each handler reads the request, calls a service in
// services/forms/, and sends the response.

import { handle } from "../utilities/http.js";
import {
  listActiveForms,
  listForms,
  getFormTree,
  createForm as createFormRow,
  archiveForm as archiveFormRow,
} from "../services/forms/queries.js";
import {
  saveFormBuilder,
  updateFormBuilder as updateFormTree,
} from "../services/forms/builder.js";

export const getForms = handle(async (req, res) => {
  res.status(200).json(await listActiveForms());
}, "Error fetching forms");

export const formsPagination = handle(async (req, res) => {
  res.status(200).json(await listForms(req.query));
}, "Error fetching paginated forms");

export const getFormById = handle(async (req, res) => {
  res.status(200).json(await getFormTree(req.params.id));
}, "Error fetching form");

export const createForm = handle(async (req, res) => {
  const form = await createFormRow(req.body);
  res.status(201).json({ message: "Form created successfully", form });
}, "Error creating form");

export const archiveForm = handle(async (req, res) => {
  await archiveFormRow(req.params.id);
  res.status(200).json({ message: "Form archived successfully" });
}, "Error archiving form");

// Create or update a form with its sections, questions and sub-questions
export const submitFormBuilder = handle(async (req, res) => {
  const formId = await saveFormBuilder(req.body);
  res.status(200).json({
    message: "Form, sections, questions, and sub-questions submitted successfully.",
    form_id: formId,
  });
}, "Error submitting form data");

// Update a form (from the URL) with its sections, questions and sub-questions
export const updateFormBuilder = handle(async (req, res) => {
  const formId = Number(req.params.id);
  await updateFormTree(formId, req.body);
  res.status(200).json({ message: "Form updated successfully.", form_id: formId });
}, "Error updating form data");
