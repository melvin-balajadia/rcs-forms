import { LuChevronRight, LuUndo2 } from "react-icons/lu";
import { STAGE_COLORS } from "./theme";
import type { PipelineStage } from "./types";

type Props = {
  stages: PipelineStage[];
  // Opens the entries at one stage
  onDrill: (stage: PipelineStage) => void;
};

const plural = (n: number) => `${n.toLocaleString()} ${n === 1 ? "entry" : "entries"}`;

// Open entries as a flow: the approval stages left to right, joined by
// arrows, with Returned set apart (it sends an entry back to its requestor).
// Each stage's bar shows its share of all open entries.
export default function PipelineFlow({ stages, onDrill }: Props) {
  const total = stages.reduce((sum, s) => sum + s.count, 0);
  const flow = stages.filter((s) => s.key !== "returned");
  const returned = stages.find((s) => s.key === "returned");

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-stretch">
      <ol className="grid flex-1 grid-cols-2 gap-3 md:flex md:items-stretch md:gap-0">
        {flow.map((stage, i) => (
          <li key={stage.key} className="flex min-w-0 items-stretch md:flex-1">
            {i > 0 && (
              <LuChevronRight
                aria-hidden
                className="mx-1 hidden h-5 w-5 shrink-0 self-center text-gray-300 md:block"
              />
            )}
            <StageTile stage={stage} total={total} onDrill={onDrill} />
          </li>
        ))}
      </ol>

      {returned && (
        <div className="flex items-stretch gap-3 border-t border-dashed border-gray-200 pt-3 lg:w-[22%] lg:border-t-0 lg:border-l lg:pt-0 lg:pl-3">
          <StageTile
            stage={returned}
            total={total}
            onDrill={onDrill}
            icon={<LuUndo2 aria-hidden className="h-3.5 w-3.5" />}
            note="Back with the requestor"
          />
        </div>
      )}
    </div>
  );
}

function StageTile({
  stage,
  total,
  onDrill,
  icon,
  note,
}: {
  stage: PipelineStage;
  total: number;
  onDrill: (stage: PipelineStage) => void;
  icon?: React.ReactNode;
  note?: string;
}) {
  const color = STAGE_COLORS[stage.key];
  const empty = stage.count === 0;
  return (
    <button
      type="button"
      onClick={() => onDrill(stage)}
      title={`View the ${plural(stage.count)}: ${stage.label.toLowerCase()}`}
      className="group flex w-full min-w-0 flex-col rounded-lg border border-gray-100 bg-gray-50/60 p-3 text-left transition-colors hover:border-gray-200 hover:bg-white hover:shadow-sm focus-visible:outline-2 focus-visible:outline-blue-500"
    >
      <span className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
        <span aria-hidden className="h-2 w-2 shrink-0 rounded-full" style={{ background: color }} />
        {icon}
        <span className="truncate">{stage.label}</span>
      </span>
      <span
        className={`mt-2 text-2xl font-semibold tabular-nums ${empty ? "text-gray-300" : "text-gray-900"}`}
      >
        {stage.count.toLocaleString()}
      </span>
      {note && <span className="text-xs text-gray-400">{note}</span>}
      <span className="mt-auto pt-2" aria-hidden>
        <span className="block h-1.5 rounded-full bg-gray-200/70">
          {!empty && (
            <span
              className="block h-full rounded-full"
              style={{ width: `${Math.max(3, (stage.count / total) * 100)}%`, background: color }}
            />
          )}
        </span>
      </span>
    </button>
  );
}
