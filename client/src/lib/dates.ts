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
