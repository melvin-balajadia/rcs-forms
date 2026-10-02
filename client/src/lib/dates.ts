// Today's date as YYYY-MM-DD in the user's own timezone.
//
// Don't use new Date().toISOString().split("T")[0] for this: toISOString() is
// UTC, so in the Philippines (UTC+8) it returns *yesterday* until 8:00 AM.
export const localDateString = (date: Date = new Date()): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

// A YYYY-MM-DD date plus n days (calendar arithmetic, no timezone involved)
export const addDays = (day: string, n: number): string => {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

// "Oct 2" / "Thu, Oct 2, 2026" for a YYYY-MM-DD date
export const formatDay = (day: string, long = false): string =>
  new Date(`${day}T00:00:00`).toLocaleDateString(
    "en-US",
    long
      ? { weekday: "short", month: "short", day: "numeric", year: "numeric" }
      : { month: "short", day: "numeric" },
  );
