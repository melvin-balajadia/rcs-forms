import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatDay } from "@/lib/dates";
import { ANIMATE, AREA_COLORS, INK } from "./theme";
import type { AreaKey, DashboardCharts, DayRow } from "./types";

type Props = {
  data: DashboardCharts["accomplished"];
  area: DashboardCharts["area"];
  // Opens the entries behind a bar (one day, optionally one area)
  onDrill: (date: string, area: AreaKey | null) => void;
};

// Forms accomplished (completed) per day, stacked by area
export default function AccomplishedChart({ data, area, onDrill }: Props) {
  const [hidden, setHidden] = useState<Set<AreaKey>>(new Set());

  // With one area selected there's one series; otherwise Main and Annex (and
  // "Other" only if some entries have no area)
  const series: AreaKey[] =
    area === "All"
      ? (["Main", "Annex", ...(data.byArea.Other > 0 ? ["Other"] : [])] as AreaKey[])
      : [area];
  const visible = series.filter((key) => !hidden.has(key));

  const toggle = (key: AreaKey) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else if (visible.length > 1) next.add(key); // keep at least one
      return next;
    });

  if (data.total === 0) {
    return (
      <div className="flex h-[280px] flex-col items-center justify-center text-center">
        <p className="text-sm font-medium text-gray-600">
          No forms were accomplished in this period
        </p>
        <p className="mt-1 text-sm text-gray-400">
          Try a longer date range or another area.
        </p>
      </div>
    );
  }

  return (
    <div>
      {series.length > 1 && (
        <div className="mb-2 flex flex-wrap gap-2" aria-label="Show or hide areas">
          {series.map((key) => {
            const off = hidden.has(key);
            return (
              <button
                key={key}
                type="button"
                aria-pressed={!off}
                onClick={() => toggle(key)}
                className={`inline-flex items-center gap-2 rounded-md border px-2.5 py-1 text-sm transition-colors ${
                  off
                    ? "border-gray-200 text-gray-400"
                    : "border-gray-200 text-gray-700 hover:bg-gray-50"
                }`}
                title={off ? `Show ${key}` : `Hide ${key}`}
              >
                <span
                  aria-hidden
                  className="inline-block h-2.5 w-2.5 rounded-sm"
                  style={{ background: off ? INK.grid : AREA_COLORS[key] }}
                />
                {key === "Other" ? "No area" : key}
                <span className="text-gray-400">{data.byArea[key]}</span>
              </button>
            );
          })}
        </div>
      )}

      <ResponsiveContainer width="100%" height={280}>
        <BarChart
          data={data.days}
          margin={{ top: 8, right: 8, left: -12, bottom: 0 }}
          barCategoryGap={data.days.length > 45 ? "12%" : "28%"}
        >
          <CartesianGrid vertical={false} stroke={INK.grid} />
          <XAxis
            dataKey="date"
            tickFormatter={(d: string) => formatDay(d)}
            tick={{ fill: INK.muted, fontSize: 12 }}
            axisLine={{ stroke: INK.axis }}
            tickLine={false}
            minTickGap={20}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fill: INK.muted, fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            width={44}
          />
          <Tooltip
            cursor={{ fill: INK.hover }}
            content={<DayTooltip series={visible} />}
          />
          {visible.map((key, i) => (
            <Bar
              key={key}
              dataKey={key}
              name={key}
              stackId="day"
              fill={AREA_COLORS[key]}
              // 1px surface gap between stacked segments
              stroke="#ffffff"
              strokeWidth={visible.length > 1 ? 1 : 0}
              // Round the top of whichever segment is highest on that day
              shape={(props: SegmentProps) => (
                <StackSegment {...props} keysAbove={visible.slice(i + 1)} />
              )}
              maxBarSize={40}
              isAnimationActive={ANIMATE}
              activeBar={{ fillOpacity: 0.8 }}
              cursor="pointer"
              onClick={(bar: { payload?: DayRow }) => {
                if (bar.payload && bar.payload.total > 0)
                  onDrill(bar.payload.date, area === "All" ? key : area);
              }}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
      <p className="mt-1 text-xs text-gray-400">
        Click a bar to open those entries.
      </p>
    </div>
  );
}

type SegmentProps = {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  fill?: string;
  fillOpacity?: number | string;
  stroke?: string;
  strokeWidth?: number | string;
  payload?: DayRow;
};

// One stacked segment. Only the day's highest non-empty segment gets the 4px
// rounded top, so every column ends the same way whatever its mix of areas.
function StackSegment({
  x = 0,
  y = 0,
  width = 0,
  height = 0,
  payload,
  keysAbove,
  ...paint
}: SegmentProps & { keysAbove: AreaKey[] }) {
  if (height <= 0 || width <= 0) return null;
  const isTop = !payload || keysAbove.every((k) => !payload[k]);
  const r = isTop ? Math.min(4, width / 2, height) : 0;
  const d = r
    ? `M${x},${y + height}V${y + r}Q${x},${y} ${x + r},${y}H${x + width - r}Q${x + width},${y} ${x + width},${y + r}V${y + height}Z`
    : `M${x},${y}H${x + width}V${y + height}H${x}Z`;
  return <path d={d} {...paint} />;
}

type TooltipProps = {
  active?: boolean;
  label?: string;
  payload?: { payload: DayRow }[];
  series: AreaKey[];
};

// Value first, then what it is; one row per visible area
function DayTooltip({ active, label, payload, series }: TooltipProps) {
  if (!active || !payload?.length || !label) return null;
  const row = payload[0].payload;
  const total = series.reduce((sum, key) => sum + row[key], 0);

  return (
    <div className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm shadow-md">
      <p className="text-gray-500">{formatDay(label, true)}</p>
      <p className="font-semibold text-gray-900">
        {total} completed
      </p>
      {series.length > 1 && (
        <ul className="mt-1 space-y-0.5">
          {series.map((key) => (
            <li key={key} className="flex items-center gap-2 text-gray-600">
              <span
                aria-hidden
                className="inline-block h-0.5 w-3"
                style={{ background: AREA_COLORS[key] }}
              />
              <span className="font-medium text-gray-900">{row[key]}</span>
              {key === "Other" ? "No area" : key}
            </li>
          ))}
        </ul>
      )}
      {total > 0 && <p className="mt-1 text-xs text-gray-400">Click to view entries</p>}
    </div>
  );
}

// Table view: only days with completions, each one a link
export function AccomplishedTable({ data, area, onDrill }: Props) {
  const rows = data.days.filter((d) => d.total > 0);
  if (rows.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-gray-400">
        No forms were accomplished in this period
      </p>
    );
  }
  const showAreas = area === "All";

  return (
    <div className="max-h-[320px] overflow-auto">
      <table className="min-w-full text-sm">
        <thead className="sticky top-0 bg-white">
          <tr className="border-b border-gray-100 text-left text-xs text-gray-500">
            <th className="px-3 py-2 font-medium">Date</th>
            {showAreas && <th className="px-3 py-2 text-right font-medium">Main</th>}
            {showAreas && <th className="px-3 py-2 text-right font-medium">Annex</th>}
            <th className="px-3 py-2 text-right font-medium">Completed</th>
            <th className="px-3 py-2" />
          </tr>
        </thead>
        <tbody className="tabular-nums">
          {rows.map((row) => (
            <tr key={row.date} className="border-b border-gray-50">
              <td className="px-3 py-2 text-gray-700">{formatDay(row.date, true)}</td>
              {showAreas && <td className="px-3 py-2 text-right text-gray-600">{row.Main}</td>}
              {showAreas && <td className="px-3 py-2 text-right text-gray-600">{row.Annex}</td>}
              <td className="px-3 py-2 text-right font-medium text-gray-900">{row.total}</td>
              <td className="px-3 py-2 text-right">
                <button
                  type="button"
                  onClick={() => onDrill(row.date, area === "All" ? null : area)}
                  className="text-blue-600 hover:underline"
                >
                  View
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
