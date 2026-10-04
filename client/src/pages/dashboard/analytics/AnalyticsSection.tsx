import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  LuCircleCheckBig,
  LuFileText,
  LuHistory,
  LuHourglass,
  LuRefreshCw,
  LuRotateCcw,
  LuUndo2,
  LuWorkflow,
} from "react-icons/lu";
import { apiGet } from "@/services/api";
import { formatDay } from "@/lib/dates";
import { AWAITING_ANY_LEVEL } from "@/lib/entryStatuses";
import FilterBar from "./FilterBar";
import ChartCard, { CardLink } from "./ChartCard";
import AccomplishedChart, { AccomplishedTable } from "./AccomplishedChart";
import EntriesByFormChart from "./EntriesByFormChart";
import PipelineFlow from "./PipelineFlow";
import MostReturnedList from "./MostReturnedList";
import RecentEntries from "./RecentEntries";
import { OldestWaiting, ReturnedList, WaitingList } from "./TodoCards";
import { useDashboardFilters } from "./useDashboardFilters";
import { TOP_FORMS } from "./theme";
import type { AreaKey, DashboardAnalytics, PipelineStage } from "./types";

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

type LinkParams = Record<string, string | null | undefined>;

// The dashboard: one filter bar, then every widget the user's role gets.
//
//   everyone            forms accomplished per day (full width)
//                       approval pipeline (full width)
//   approvers, admins   waiting for your approval (2/3) | returned entries (1/3)
//                       entries per form (2/3)          | most-returned forms (1/3)
//   requestors          entries per form (2/3)          | my returned entries (1/3)
//   everyone            recent form entries (full width)
export default function AnalyticsSection() {
  const navigate = useNavigate();
  const filters = useDashboardFilters();
  const { from, to, area, site } = filters;

  const query = new URLSearchParams({ from, to });
  if (area !== "All") query.set("area", area);
  if (site) query.set("site", site);

  const { data, isLoading, isError, isFetching, dataUpdatedAt, refetch } =
    useQuery<DashboardAnalytics>({
      queryKey: ["dashboard-analytics", query.toString()],
      queryFn: () => apiGet<DashboardAnalytics>(`/dashboard/analytics?${query}`),
      // Keep the current widgets on screen (dimmed) while the next ones load
      placeholderData: keepPreviousData,
    });

  // Links into the Form Entry list, filtered to exactly what a widget counts
  const openEntries = (params: LinkParams) => {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) if (value) search.set(key, value);
    navigate(`/form-entry?${search}`);
  };

  const period =
    from === to ? formatDay(from, true) : `${formatDay(from)} – ${formatDay(to, true)}`;
  const updated = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : null;

  return (
    <section className="mt-6" aria-label="Dashboard analytics">
      {/* Toolbar: filters on the left, the period and freshness on the right */}
      <div className="flex flex-col gap-3 rounded-xl border border-gray-200/70 bg-white p-3 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <FilterBar
          filters={filters}
          canChooseSite={data?.canChooseSite ?? false}
          sites={data?.sites ?? []}
          currentSite={data?.site ?? null}
        />
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-1 text-sm text-gray-500">
          <span>
            Showing <span className="font-medium text-gray-700">{period}</span>
          </span>
          {updated && (
            <button
              type="button"
              onClick={() => refetch()}
              className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 hover:text-gray-700"
              title="Refresh now"
            >
              <LuRefreshCw aria-hidden className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
              Updated {updated}
            </button>
          )}
        </div>
      </div>

      {isError && !data && (
        <p className="mt-4 rounded-lg border border-red-100 bg-red-50 p-4 text-sm text-red-600">
          Couldn't load the dashboard. Check the date range and try again.
        </p>
      )}
      {isLoading && <LoadingLayout />}

      {data && (
        <>
          {!data.site && (
            <p className="mt-4 rounded-lg border border-amber-100 bg-amber-50 p-4 text-sm text-amber-800">
              Your account has no site assigned, so there's nothing to show yet.
              Ask an administrator to set your site.
            </p>
          )}
          <Widgets
            data={data}
            refreshing={isFetching}
            openEntries={openEntries}
            openEntry={(id) => navigate(`/form-entry/edit/${id}`)}
          />
        </>
      )}
    </section>
  );
}

type WidgetsProps = {
  data: DashboardAnalytics;
  refreshing: boolean;
  openEntries: (params: LinkParams) => void;
  openEntry: (id: number) => void;
};

function Widgets({ data, refreshing, openEntries, openEntry }: WidgetsProps) {
  const [showAllForms, setShowAllForms] = useState(false);
  const mine = data.scope === "mine";
  const openTotal = data.pipeline.reduce((sum, s) => sum + s.count, 0);
  const hiddenForms = data.byForm.forms.length - TOP_FORMS;

  // Every link keeps the dashboard's site and area
  const scope = { site: data.site, area: data.area !== "All" ? data.area : null };
  const drillDay = (date: string, dayArea: AreaKey | null) =>
    openEntries({
      status: "completed",
      ...scope,
      area: dayArea === "Other" ? null : (dayArea ?? scope.area),
      completed_from: date,
      completed_to: date,
    });
  const drillForm = (formId: number) =>
    openEntries({ form_id: String(formId), ...scope, from: data.from, to: data.to });
  const drillStage = (stage: PipelineStage) =>
    openEntries({ status: stage.statuses.join(","), ...scope });
  const drillReturned = (formId: number) =>
    openEntries({
      form_id: String(formId),
      ...scope,
      returned_from: data.from,
      returned_to: data.to,
    });

  const accomplished = (
    <ChartCard
      className="lg:col-span-3"
      icon={LuCircleCheckBig}
      accent="green"
      title={mine ? "My forms accomplished per day" : "Forms accomplished per day"}
      timeframe="period"
      metric={data.accomplished.total}
      metricLabel={`${plural(data.accomplished.total, "form", "forms")} completed`}
      refreshing={refreshing}
      table={<AccomplishedTable data={data.accomplished} area={data.area} onDrill={drillDay} />}
    >
      <AccomplishedChart data={data.accomplished} area={data.area} onDrill={drillDay} />
    </ChartCard>
  );

  const pipeline = (
    <ChartCard
      className="lg:col-span-3"
      icon={LuWorkflow}
      accent="blue"
      title={mine ? "My entries in progress" : "Approval pipeline"}
      timeframe="now"
      metric={openTotal}
      metricLabel={`open ${plural(openTotal, "entry", "entries")} · click a stage to open them`}
      refreshing={refreshing}
    >
      <PipelineFlow stages={data.pipeline} onDrill={drillStage} />
    </ChartCard>
  );

  const waiting = data.waiting && (
    <ChartCard
      className="lg:col-span-2"
      icon={LuHourglass}
      accent="amber"
      title="Waiting for your approval"
      timeframe="now"
      metric={data.waiting.total}
      metricLabel={`${plural(data.waiting.total, "entry", "entries")}, oldest first`}
      aside={data.waiting.items[0] && <OldestWaiting days={data.waiting.items[0].days_waiting} />}
      refreshing={refreshing}
      footer={
        data.waiting.total > 0 && (
          <CardLink onClick={() => openEntries({ status: AWAITING_ANY_LEVEL, ...scope })}>
            {data.waiting.total > data.waiting.items.length
              ? `View all ${data.waiting.total}`
              : "Open in Form Entries"}
          </CardLink>
        )
      }
    >
      <WaitingList items={data.waiting.items} onOpen={openEntry} />
    </ChartCard>
  );

  const returned = (
    <ChartCard
      icon={LuUndo2}
      accent="orange"
      title={mine ? "My returned entries" : "Returned entries"}
      timeframe="now"
      metric={data.returned.total}
      metricLabel={mine ? "to fix" : "waiting for corrections"}
      refreshing={refreshing}
      footer={
        data.returned.total > 0 && (
          <CardLink onClick={() => openEntries({ status: "returned", ...scope })}>
            {data.returned.total > data.returned.items.length
              ? `View all ${data.returned.total}`
              : "Open in Form Entries"}
          </CardLink>
        )
      }
    >
      <ReturnedList items={data.returned.items} mine={mine} onOpen={openEntry} />
    </ChartCard>
  );

  const byForm = (
    <ChartCard
      className="lg:col-span-2"
      icon={LuFileText}
      accent="indigo"
      title={mine ? "My entries per form" : "Entries per form"}
      timeframe="period"
      metric={data.byForm.total}
      metricLabel={`${plural(data.byForm.total, "entry", "entries")} by entry date`}
      refreshing={refreshing}
      footer={
        data.byForm.forms.length > 0 && (
          <div className="flex items-center justify-between gap-3 text-xs text-gray-400">
            <span>Click a form to open its entries.</span>
            {hiddenForms > 0 && (
              <button
                type="button"
                onClick={() => setShowAllForms((v) => !v)}
                className="text-sm font-medium text-blue-600 hover:text-blue-800"
              >
                {showAllForms ? `Show top ${TOP_FORMS}` : `Show ${hiddenForms} more`}
              </button>
            )}
          </div>
        )
      }
    >
      <EntriesByFormChart forms={data.byForm.forms} showAll={showAllForms} onDrill={drillForm} />
    </ChartCard>
  );

  const mostReturned = data.mostReturned && (
    <ChartCard
      icon={LuRotateCcw}
      accent="rose"
      title="Most-returned forms"
      timeframe="period"
      metric={data.mostReturned.total}
      metricLabel={`${plural(data.mostReturned.total, "entry", "entries")} returned`}
      refreshing={refreshing}
      footer={
        data.mostReturned.forms.length > 0 && (
          <span className="text-xs text-gray-400">Click a form to open its returned entries.</span>
        )
      }
    >
      <MostReturnedList forms={data.mostReturned.forms} onDrill={drillReturned} />
    </ChartCard>
  );

  const recent = (
    <ChartCard
      className="lg:col-span-3"
      icon={LuHistory}
      accent="slate"
      title={mine ? "My recent form entries" : "Recent form entries"}
      timeframe="latest"
      refreshing={refreshing}
      footer={<CardLink onClick={() => openEntries({ ...scope })}>View all entries</CardLink>}
    >
      <RecentEntries entries={data.recent} mine={mine} onOpen={openEntry} />
    </ChartCard>
  );

  return (
    <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
      {accomplished}
      {pipeline}
      {waiting ? (
        <>
          {waiting}
          {returned}
          {byForm}
          {mostReturned}
        </>
      ) : (
        <>
          {byForm}
          {returned}
        </>
      )}
      {recent}
    </div>
  );
}

// Placeholders in the shape of the layout, while the first load runs
function LoadingLayout() {
  const block = "animate-pulse rounded-xl bg-gray-100";
  return (
    <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3" aria-hidden>
      <div className={`h-[400px] lg:col-span-3 ${block}`} />
      <div className={`h-[200px] lg:col-span-3 ${block}`} />
      <div className={`h-[320px] lg:col-span-2 ${block}`} />
      <div className={`h-[320px] ${block}`} />
    </div>
  );
}
