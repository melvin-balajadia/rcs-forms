import { hasRole } from "../../middleware/requireRole.js";
import { SUPER_APPROVER_ROLES, VALID_SITES } from "../formEntries/rules.js";
import {
  resolveDashboardFilters,
  scopeConditions,
  accomplishedPerDay,
  entriesPerForm,
} from "./charts.js";
import { waitingForUser, returnedEntries, recentEntries } from "./todo.js";
import { pipeline, mostReturned } from "./pipeline.js";

// GET /api/dashboard/analytics — everything on the dashboard, for one set of
// filters (?from&to&area&site), in one response. Widgets that don't apply to
// the user's role are null.
//
//   accomplished — completed entries per day (date range)
//   byForm       — entries per form, by entry date (date range)
//   pipeline     — open entries per stage, right now
//   waiting      — waiting for this user's approval, right now (approvers)
//   returned     — returned for correction, right now: the user's own
//                  (requestors) or all they may see (approvers, admins)
//   mostReturned — forms returned the most in the date range (approvers)
//   recent       — the 5 newest entries, any status
//
// Approvers see their assigned forms and admins the whole site; requestors
// see only their own entries (the usual entry visibility rules).
export const getDashboardAnalytics = async (req) => {
  const filters = resolveDashboardFilters(req.user, req.query);
  const { from, to, site, area, canChooseSite } = filters;
  const user = req.user;
  const isAdmin = hasRole(user, ...SUPER_APPROVER_ROLES);
  const canApprove = isAdmin || hasRole(user, "approver");

  // A user without a site has nothing to show yet
  const scope = site ? await scopeConditions(req, filters) : null;

  const [accomplished, byForm, stages, waiting, returned, returns, recent] = await Promise.all([
    accomplishedPerDay(scope, filters),
    entriesPerForm(scope, filters),
    pipeline(scope, { includePending: isAdmin || !canApprove }),
    canApprove ? waitingForUser(user, scope) : null,
    returnedEntries(user, scope, { mine: !canApprove }),
    canApprove ? mostReturned(scope, filters) : null,
    recentEntries(scope),
  ]);

  return {
    site,
    area: area ?? "All",
    from,
    to,
    canChooseSite,
    sites: canChooseSite ? VALID_SITES : site ? [site] : [],
    scope: canApprove ? "site" : "mine",
    accomplished,
    byForm,
    pipeline: stages,
    waiting,
    returned,
    mostReturned: returns,
    recent,
  };
};
