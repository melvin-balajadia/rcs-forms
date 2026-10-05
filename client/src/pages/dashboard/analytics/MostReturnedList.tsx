import BarList, { EmptyList } from "./BarList";
import { RETURN_COLOR } from "./theme";
import type { FormCount } from "./types";

// Forms whose entries were sent back the most in the period, most first
export default function MostReturnedList({
  forms,
  onDrill,
}: {
  forms: FormCount[];
  onDrill: (formId: number) => void;
}) {
  if (forms.length === 0) {
    return (
      <EmptyList title="Nothing was returned in this period" hint="No form needed corrections." />
    );
  }
  return (
    <BarList
      ranked
      color={RETURN_COLOR}
      items={forms.map((form) => ({
        key: form.form_id,
        label: form.form_name,
        count: form.count,
        title: `View the ${form.count} returned ${form.count === 1 ? "entry" : "entries"} for ${form.form_name}`,
        onClick: () => onDrill(form.form_id),
      }))}
    />
  );
}
