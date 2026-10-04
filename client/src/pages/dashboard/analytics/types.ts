// Response of GET /api/dashboard/todo (null when the list doesn't apply)
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
  returned_by: string | null;
  returned_at: string | null;
  level_label: string | null;
  remarks: string | null;
  area: string | null;
};

export type DashboardTodo = {
  site: string | null;
  area: "All" | "Main" | "Annex";
  waiting: { total: number; items: WaitingItem[] } | null;
  returned: { total: number; items: ReturnedItem[] } | null;
};

// Response of GET /api/dashboard/charts

export type AreaKey = "Main" | "Annex" | "Other";

export type DayRow = {
  date: string; // YYYY-MM-DD (Philippine time)
  Main: number;
  Annex: number;
  Other: number;
  total: number;
};

export type FormCount = { form_id: number; form_name: string; count: number };

export type DashboardCharts = {
  site: string | null;
  area: "All" | "Main" | "Annex";
  from: string;
  to: string;
  canChooseSite: boolean;
  sites: string[];
  scope: "mine" | "site";
  accomplished: {
    total: number;
    byArea: Record<AreaKey, number>;
    days: DayRow[];
  };
  byForm: { total: number; forms: FormCount[] };
};
