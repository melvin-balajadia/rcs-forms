// Calendar days in Philippine time (UTC+8, no daylight saving).
//
// The database stores timestamps in UTC, so a form approved at 7:00 AM in
// Manila is 23:00 the previous day in UTC. Anything that groups or filters by
// "day" for users must use these helpers instead of the UTC date.

const OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

export const isDay = (value) =>
  typeof value === "string" &&
  DAY_RE.test(value) &&
  !Number.isNaN(Date.parse(`${value}T00:00:00Z`));

// YYYY-MM-DD of a timestamp, in Manila
export const manilaDay = (date) =>
  new Date(new Date(date).getTime() + OFFSET_MS).toISOString().slice(0, 10);

export const manilaToday = () => manilaDay(new Date());

// YYYY-MM-DD plus n days
export const addDays = (day, n) => {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

// The UTC instant when a Manila day starts
export const manilaDayStart = (day) => new Date(`${day}T00:00:00+08:00`);

// Every day from `from` through `to`
export const eachDay = (from, to) => {
  const days = [];
  for (let d = from; d <= to; d = addDays(d, 1)) days.push(d);
  return days;
};

// Whole number of days between two YYYY-MM-DD values
export const daysBetween = (from, to) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
