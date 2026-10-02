import { useSearchParams } from "react-router-dom";
import { addDays, localDateString } from "@/lib/dates";

// The dashboard's filters live in the URL (?range=30&area=Annex&site=…), so a
// view survives a refresh and can be shared as a link.

export type RangePreset = "today" | "7" | "30" | "90" | "custom";

export const RANGE_OPTIONS: { value: RangePreset; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
  { value: "custom", label: "Custom range" },
];

const PRESET_DAYS: Record<Exclude<RangePreset, "custom">, number> = {
  today: 1,
  "7": 7,
  "30": 30,
  "90": 90,
};

export const AREA_OPTIONS = ["All", "Main", "Annex"] as const;

export function useDashboardFilters() {
  const [params, setParams] = useSearchParams();
  const today = localDateString();

  const rawRange = params.get("range") as RangePreset | null;
  const range: RangePreset =
    rawRange && RANGE_OPTIONS.some((o) => o.value === rawRange) ? rawRange : "30";

  let from: string;
  let to: string;
  if (range === "custom") {
    to = params.get("to") || today;
    from = params.get("from") || addDays(to, -29);
  } else {
    to = today;
    from = addDays(today, -(PRESET_DAYS[range] - 1));
  }

  const rawArea = params.get("area");
  const area = AREA_OPTIONS.includes(rawArea as (typeof AREA_OPTIONS)[number])
    ? (rawArea as (typeof AREA_OPTIONS)[number])
    : "All";
  const site = params.get("site") || undefined;

  // Change one or more filters; null removes a filter
  const update = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(changes)) {
      if (value === null || value === "") next.delete(key);
      else next.set(key, value);
    }
    setParams(next, { replace: true });
  };

  return { range, from, to, area, site, today, update };
}
