// Pure booking rules (no I/O) so they are easy to test.
const pad = (n) => String(n).padStart(2, "0");

export const toMin = (t) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};
export const fromMin = (n) => `${pad(Math.floor(n / 60))}:${pad(n % 60)}`;
export const isTime = (s) => /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
export const isDate = (s) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
};
export const localDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const localTime = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

/** Two bookings clash when they use the same venue+date and their time ranges intersect. */
export const overlaps = (a, b) =>
  String(a.venue_id) === String(b.venue_id) &&
  a.date === b.date &&
  toMin(a.start) < toMin(b.end) &&
  toMin(b.start) < toMin(a.end);

export function validateBookingInput(raw, venue, now, hours) {
  const s = (v) => (typeof v === "string" ? v.trim() : "");
  const value = {
    venue_id: venue.id,
    date: s(raw.date),
    start: s(raw.start),
    end: s(raw.end),
    event_name: s(raw.event_name),
    purpose: s(raw.purpose),
    attendees: Number(raw.attendees),
  };
  const fail = (error) => ({ ok: false, error });

  if (value.event_name.length < 3 || value.event_name.length > 120)
    return fail("Event name must be 3 to 120 characters.");
  if (value.purpose.length < 5 || value.purpose.length > 1000)
    return fail("Event purpose must be 5 to 1000 characters.");
  if (!isDate(value.date)) return fail("Choose a valid date.");
  if (!isTime(value.start) || !isTime(value.end)) return fail("Choose valid start and end times.");
  if (toMin(value.end) <= toMin(value.start)) return fail("End time must be after the start time.");
  if (toMin(value.end) - toMin(value.start) < 30) return fail("Minimum booking length is 30 minutes.");
  if (toMin(value.start) < toMin(hours.open) || toMin(value.end) > toMin(hours.close))
    return fail(`Bookings are allowed between ${hours.open} and ${hours.close}.`);
  if (!Number.isInteger(value.attendees) || value.attendees < 1)
    return fail("Expected attendees must be a whole number of at least 1.");
  if (value.attendees > Number(venue.capacity))
    return fail(`${venue.name} holds at most ${venue.capacity} people.`);

  const today = localDate(now);
  if (value.date < today) return fail("The date cannot be in the past.");
  if (value.date === today && toMin(value.start) <= toMin(localTime(now)))
    return fail("That start time has already passed today.");
  const limit = new Date(now);
  limit.setDate(limit.getDate() + 365);
  if (value.date > localDate(limit)) return fail("Bookings can be made up to one year ahead.");
  return { ok: true, value };
}

/** Free windows in a venue's day, given the APPROVED bookings. */
export function freeSlots(approved, venueId, date, hours, minMinutes = 30) {
  const busy = approved
    .filter((b) => String(b.venue_id) === String(venueId) && b.date === date)
    .map((b) => [toMin(b.start), toMin(b.end)])
    .sort((a, b) => a[0] - b[0]);
  const out = [];
  let cursor = toMin(hours.open);
  const close = toMin(hours.close);
  for (const [s, e] of busy) {
    if (s - cursor >= minMinutes) out.push({ start: fromMin(cursor), end: fromMin(s) });
    cursor = Math.max(cursor, e);
  }
  if (close - cursor >= minMinutes) out.push({ start: fromMin(cursor), end: fromMin(close) });
  return out;
}

/** Group pending requests into connected clusters of overlapping requests. */
export function conflictGroups(pending) {
  const parent = pending.map((_, i) => i);
  const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (let i = 0; i < pending.length; i++)
    for (let j = i + 1; j < pending.length; j++)
      if (overlaps(pending[i], pending[j])) parent[find(i)] = find(j);
  const groups = new Map();
  pending.forEach((b, i) => {
    const r = find(i);
    if (!groups.has(r)) groups.set(r, []);
    groups.get(r).push(b);
  });
  return [...groups.values()]
    .map((g) => g.sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)) || a.id - b.id))
    .sort((a, b) => a[0].date.localeCompare(b[0].date) || a[0].start.localeCompare(b[0].start));
}
