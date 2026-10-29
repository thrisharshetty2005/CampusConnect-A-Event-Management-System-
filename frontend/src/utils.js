export const pad = (n) => String(n).padStart(2, "0");
export const toMin = (t) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };

export const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
// Dates are handled as "YYYY-MM-DD" strings in UTC so time zones never shift them.
export const addDays = (s, n) => {
  const d = new Date(`${s}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
export const mondayOf = (s) => {
  const dow = (new Date(`${s}T00:00:00Z`).getUTCDay() + 6) % 7; // Mon=0
  return addDays(s, -dow);
};
export const dayLabel = (s) =>
  new Date(`${s}T00:00:00Z`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
export const longDate = (s) =>
  new Date(`${s}T00:00:00Z`).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

export function freeSlots(busyList, hours, minMinutes = 30) {
  const busy = busyList.map((b) => [toMin(b.start), toMin(b.end)]).sort((a, b) => a[0] - b[0]);
  const out = [];
  let cur = toMin(hours.open);
  const close = toMin(hours.close);
  const f = (n) => `${pad(Math.floor(n / 60))}:${pad(n % 60)}`;
  for (const [s, e] of busy) {
    if (s - cur >= minMinutes) out.push({ start: f(cur), end: f(s) });
    cur = Math.max(cur, e);
  }
  if (close - cur >= minMinutes) out.push({ start: f(cur), end: f(close) });
  return out;
}
