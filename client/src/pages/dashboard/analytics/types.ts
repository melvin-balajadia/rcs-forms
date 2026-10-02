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
