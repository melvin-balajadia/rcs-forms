// Form entry endpoints. Each handler reads the request, calls a service in
// services/formEntries/, and sends the response; expected failures come back
// from the services as HttpError (see utilities/http.js).

import { handle } from "../utilities/http.js";
import {
  listAllEntries,
  listEntries,
  getEntry,
  getEntryAnswers,
  archiveEntry,
} from "../services/formEntries/queries.js";
import { createEntry, updateEntry } from "../services/formEntries/entries.js";
import {
  submitEntry,
  decideEntry,
  returnEntry,
} from "../services/formEntries/approvals.js";
import { getApprovalHistory as buildApprovalHistory } from "../services/formEntries/history.js";

export const getFormEntries = handle(async (req, res) => {
  res.status(200).json(await listAllEntries());
}, "Error fetching form entries");

export const formEntriesPagination = handle(async (req, res) => {
  res.status(200).json(await listEntries(req));
}, "Error fetching paginated form entries");

export const getFormEntryById = handle(async (req, res) => {
  res.status(200).json(await getEntry(req, req.params.id));
}, "Error fetching form entry");

export const getQuestionValuesByEntryId = handle(async (req, res) => {
  res.status(200).json(await getEntryAnswers(req, req.params.entryId));
}, "Error fetching question values");

export const getApprovalHistory = handle(async (req, res) => {
  res.status(200).json(await buildApprovalHistory(req, req.params.id));
}, "Error fetching approval history");

export const archiveFormEntry = handle(async (req, res) => {
  await archiveEntry(req.params.id);
  res.status(200).json({ message: "Form entry archived successfully" });
}, "Error archiving form entry");

export const createFormEntryBuilder = handle(async (req, res) => {
  const { entry, answers, status } = await createEntry(req.user, req.body);
  res.status(201).json({
    message: `Form entry saved as ${status} successfully`,
    entry,
    answers,
  });
}, "Error creating form entry with answers");

export const updateFormEntryBuilder = handle(async (req, res) => {
  const { entry, answers, status } = await updateEntry(
    req.user,
    Number(req.params.entryId),
    req.body,
  );
  res.status(200).json({
    message: `Form entry updated as ${status} successfully`,
    entry,
    answers,
  });
}, "Error updating form entry");

export const submitForApproval = handle(async (req, res) => {
  res.status(200).json(await submitEntry(req.user, req.body));
}, "Error submitting form for approval");

export const approveFormEntry = handle(async (req, res) => {
  res.status(200).json(await decideEntry(req.user, req.body));
}, "Error processing approval");

export const returnFormEntry = handle(async (req, res) => {
  res.status(200).json(await returnEntry(req.user, req.body));
}, "Error returning form entry");
