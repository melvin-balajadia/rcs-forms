import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { apiGet } from "@/services/api";
import { formatDay } from "@/lib/dates";
import FilterBar from "./FilterBar";
import ChartCard from "./ChartCard";
import AccomplishedChart, { AccomplishedTable } from "./AccomplishedChart";
import EntriesByFormChart from "./EntriesByFormChart";
import { useDashboardFilters } from "./useDashboardFilters";
import type { AreaKey, DashboardCharts } from "./types";

const plural = (n: number, one: string, many: string) =>
  `${n.toLocaleString()} ${n === 1 ? one : many}`;

// Dashboard analytics: one filter bar, then the charts it controls
export default function AnalyticsSection() {
  const navigate = useNavigate();
  const filters = useDashboardFilters();
  const { from, to, area, site } = filters;

  const query = new URLSearchParams({ from, to });
  if (area !== "All") query.set("area", area);
  if (site) query.set("site", site);

  const { data, isLoading, isError, isFetching } = useQuery<DashboardCharts>({
    queryKey: ["dashboard-charts", query.toString()],
    queryFn: () => apiGet<DashboardCharts>(`/dashboard/charts?${query}`),
    // Keep the current charts on screen (dimmed) while the next ones load
    placeholderData: keepPreviousData,
  });

  // Links into the Form Entry list, filtered to exactly what a bar counts
  const openEntries = (params: Record<string, string | null | undefined>) => {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) if (value) search.set(key, value);
    navigate(`/form-entry?${search}`);
  };
  const scopeParams = {
    site: data?.site,
    area: data && data.area !== "All" ? data.area : null,
  };
  const drillDay = (date: string, dayArea: AreaKey | null) =>
    openEntries({
      status: "completed",
      ...scopeParams,
      area: dayArea === "Other" ? null : (dayArea ?? scopeParams.area),
      completed_from: date,
      completed_to: date,
    });
  const drillForm = (formId: number) =>
    openEntries({
      form_id: String(formId),
      ...scopeParams,
      from: data?.from,
      to: data?.to,
    });

  const period =
    from === to ? formatDay(from, true) : `${formatDay(from)} – ${formatDay(to, true)}`;

  return (
    <section className="mt-6" aria-labelledby="analytics-heading">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="analytics-heading" className="text-lg font-semibold text-gray-800">
          Analytics
        </h2>
        <p className="text-sm text-gray-500">{period}</p>
      </div>

      <FilterBar
        filters={filters}
        canChooseSite={data?.canChooseSite ?? false}
        sites={data?.sites ?? []}
        currentSite={data?.site ?? null}
      />

      {isError && !data && (
        <p className="mt-4 rounded-lg border border-red-100 bg-red-50 p-4 text-sm text-red-600">
          Couldn't load the charts. Check the date range and try again.
        </p>
      )}
      {isLoading && (
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <div className="h-[360px] animate-pulse rounded-lg bg-gray-100 lg:col-span-2" />
          <div className="h-[360px] animate-pulse rounded-lg bg-gray-100" />
        </div>
      )}

      {data && (
        <>
          {!data.site && (
            <p className="mt-4 rounded-lg border border-amber-100 bg-amber-50 p-4 text-sm text-amber-800">
              Your account has no site assigned, so there's nothing to show yet.
              Ask an administrator to set your site.
            </p>
          )}
          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            <ChartCard
              className="lg:col-span-2"
              title="Forms accomplished per day"
              summary={`${plural(data.accomplished.total, "form", "forms")} completed${
                data.scope === "mine" ? " (yours)" : ""
              }`}
              refreshing={isFetching}
              table={<AccomplishedTable data={data.accomplished} area={data.area} onDrill={drillDay} />}
            >
              <AccomplishedChart data={data.accomplished} area={data.area} onDrill={drillDay} />
            </ChartCard>

            <ChartCard
              title={data.scope === "mine" ? "My entries per form" : "Entries per form"}
              summary={`${plural(data.byForm.total, "entry", "entries")} by entry date`}
              refreshing={isFetching}
            >
              <EntriesByFormChart forms={data.byForm.forms} onDrill={drillForm} />
            </ChartCard>
          </div>
        </>
      )}
    </section>
  );
}
