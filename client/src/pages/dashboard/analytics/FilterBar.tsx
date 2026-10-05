import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AREA_OPTIONS,
  RANGE_OPTIONS,
  type RangePreset,
  useDashboardFilters,
} from "./useDashboardFilters";

type Props = {
  filters: ReturnType<typeof useDashboardFilters>;
  // Site picker: only all_access may look at other sites
  canChooseSite: boolean;
  sites: string[];
  currentSite: string | null;
};

// One row above the charts; every chart below follows these filters
export default function FilterBar({ filters, canChooseSite, sites, currentSite }: Props) {
  const { range, from, to, area, today, update } = filters;

  const onRangeChange = (value: string) => {
    if (value === "custom") {
      // Start the custom range from what's on screen now
      update({ range: "custom", from, to });
    } else {
      update({ range: value, from: null, to: null });
    }
  };

  return (
    <div
      className="flex flex-wrap items-center gap-3"
      role="group"
      aria-label="Dashboard filters"
    >
      <Select value={range} onValueChange={onRangeChange}>
        <SelectTrigger className="w-[170px] bg-white" aria-label="Date range">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {RANGE_OPTIONS.map((o) => (
            <SelectItem key={o.value} value={o.value as RangePreset}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {range === "custom" && (
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <input
            type="date"
            aria-label="From"
            className="h-9 rounded-md border border-gray-200 bg-white px-2"
            value={from}
            max={to}
            onChange={(e) => e.target.value && update({ from: e.target.value })}
          />
          <span aria-hidden>–</span>
          <input
            type="date"
            aria-label="To"
            className="h-9 rounded-md border border-gray-200 bg-white px-2"
            value={to}
            min={from}
            max={today}
            onChange={(e) => e.target.value && update({ to: e.target.value })}
          />
        </div>
      )}

      {canChooseSite && sites.length > 0 && (
        <Select
          value={currentSite ?? undefined}
          onValueChange={(value) => update({ site: value })}
        >
          <SelectTrigger className="w-[160px] bg-white" aria-label="Site">
            <SelectValue placeholder="Site" />
          </SelectTrigger>
          <SelectContent>
            {sites.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {!canChooseSite && currentSite && (
        <span className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-600">
          Site: <span className="font-medium text-gray-800">{currentSite}</span>
        </span>
      )}

      <div
        className="inline-flex rounded-md border border-gray-200 bg-white p-0.5"
        role="radiogroup"
        aria-label="Area"
      >
        {AREA_OPTIONS.map((option) => {
          const selected = area === option;
          return (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => update({ area: option === "All" ? null : option })}
              className={`rounded px-3 py-1 text-sm transition-colors ${
                selected
                  ? "bg-gray-800 font-medium text-white"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              {option === "All" ? "All areas" : option}
            </button>
          );
        })}
      </div>
    </div>
  );
}
