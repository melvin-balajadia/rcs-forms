// Response of GET /api/dashboard/analytics. Widgets that don't apply to the
// user's role are null.

export type AreaKey = "Main" | "Annex" | "Other";

export type DayRow = {
  date: string; // YYYY-MM-DD (Philippine time)
  Main: number;
  Annex: number;
  Other: number;
  total: number;
};

export type FormCount = { form_id: number; form_name: string; count: number };

export type PipelineStage = {
  key: "pending" | "first" | "second" | "third" | "returned";
  label: string;
  statuses: string[];
  count: number;
};

export type WaitingItem = {
  id: number;
  form_name: string;
  requested_by: string | null;
  area: string | null;
  level: "first" | "second" | "third";
  level_label: string;
  waiting_since: string;
  days_waiting: number;
};

export type ReturnedItem = {
  id: number;
  form_name: string;
  requested_by: string | null;
  returned_by: string | null;
  returned_at: string | null;
  level_label: string | null;
  remarks: string | null;
  area: string | null;
};

export type RecentEntry = {
  id: number;
  form_name: string;
  status: string;
  area: string | null;
  requested_by: string | null;
  created_at: string;
};

export type DashboardAnalytics = {
  site: string | null;
  area: "All" | "Main" | "Annex";
  from: string;
  to: string;
  canChooseSite: boolean;
  sites: string[];
  // Requestors only ever see their own entries
  scope: "mine" | "site";
  accomplished: {
    total: number;
    byArea: Record<AreaKey, number>;
    days: DayRow[];
  };
  byForm: { total: number; forms: FormCount[] };
  pipeline: PipelineStage[];
  waiting: { total: number; items: WaitingItem[] } | null;
  returned: { total: number; items: ReturnedItem[] };
  mostReturned: { total: number; forms: FormCount[] } | null;
  recent: RecentEntry[];
};
