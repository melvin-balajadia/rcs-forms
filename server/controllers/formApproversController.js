// Approver assignment endpoints; the logic lives in services/formApprovers.js.

import { handle } from "../utilities/http.js";
import {
  getUserApprovals,
  setUserApprovals,
  getFormApprovers,
  setFormApprovers,
} from "../services/formApprovers.js";

export const getFormApproversByUser = handle(async (req, res) => {
  res.status(200).json(await getUserApprovals(req.params.userId));
}, "Error fetching user's form approvals");

export const updateUserFormApprovals = handle(async (req, res) => {
  const assignmentsCount = await setUserApprovals(
    req.params.userId,
    req.body.assignments,
  );
  res.status(200).json({
    message: "User form approvals updated successfully",
    assignmentsCount,
  });
}, "Error updating user's form approvals");

export const getApproversByForm = handle(async (req, res) => {
  res.status(200).json(await getFormApprovers(req.params.formId));
}, "Error fetching form approvers");

export const updateFormApprovers = handle(async (req, res) => {
  const assignmentsCount = await setFormApprovers(
    req.params.formId,
    req.body.assignments,
  );
  res.status(200).json({
    message: "Form approvers updated successfully",
    assignmentsCount,
  });
}, "Error updating form's approvers");

// Placeholder kept for its route; not used by the UI
export const checkUserCanApprove = handle(async (req, res) => {
  res.status(200).json({
    message: "This endpoint will be implemented in approval logic phase",
    canApprove: false,
  });
}, "Error checking approval permission");
