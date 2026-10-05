// Status rules for the requestor-side endpoints (create-builder and
// update-builder). Approval-side changes (submit, approve, reject, return)
// have their own checks in formEntriesController.
//
//   draft ⇄ pending ──submit──► submitted_first ──approve──► approved_first
//     ──approve──► approved_second ──approve──► completed
//   any approval stage ──return──► returned ──edit──► pending (resubmit)
//   any approval stage ──reject──► rejected
//
// completed and rejected are final.

// Statuses a new entry may start in
export const CREATE_STATUSES = ["draft", "pending"];

// Current status → statuses the owner may save it as. Anything not listed
// (approval stages, completed, rejected) is locked for editing.
export const EDIT_TRANSITIONS = {
  draft: ["draft", "pending"],
  pending: ["draft", "pending"],
  returned: ["returned", "pending"],
};

export const canEditTo = (current, next) =>
  (EDIT_TRANSITIONS[current] || []).includes(next);
