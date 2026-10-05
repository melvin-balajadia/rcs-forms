import BarList, { EmptyList } from "./BarList";
import { TOP_FORMS } from "./theme";
import type { FormCount } from "./types";

type Props = {
  forms: FormCount[];
  showAll: boolean;
  // Opens the entries of one form
  onDrill: (formId: number) => void;
};

// Entries per form as a ranked list: the full form name and its count on one
// line, a thin bar beneath. The longest bar is always the top form.
export default function EntriesByFormChart({ forms, showAll, onDrill }: Props) {
  if (forms.length === 0) {
    return (
      <EmptyList
        title="No entries in this period"
        hint="Try a longer date range or another area."
      />
    );
  }

  const rows = showAll ? forms : forms.slice(0, TOP_FORMS);
  return (
    <BarList
      ranked
      twoColumns
      max={forms[0].count} // sorted most first
      items={rows.map((form) => ({
        key: form.form_id,
        label: form.form_name,
        count: form.count,
        title: `View the ${form.count} ${form.count === 1 ? "entry" : "entries"} for ${form.form_name}`,
        onClick: () => onDrill(form.form_id),
      }))}
    />
  );
}
