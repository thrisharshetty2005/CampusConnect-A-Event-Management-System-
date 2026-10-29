import test from "node:test";
import assert from "node:assert/strict";
import { overlaps, validateBookingInput, freeSlots, conflictGroups } from "./rules.js";

const hours = { open: "07:00", close: "22:00" };
const venue = { id: 1, name: "Main Auditorium", capacity: 500 };
const now = new Date(2026, 9, 27, 10, 0); // 27 Oct 2026 10:00 local
const good = { date: "2026-10-30", start: "10:00", end: "12:00", event_name: "Tech Fest", purpose: "Annual fest", attendees: 200 };

test("overlap rules", () => {
  const a = { venue_id: 1, date: "2026-10-30", start: "10:00", end: "12:00" };
  assert.equal(overlaps(a, { ...a, start: "11:00", end: "13:00" }), true);
  assert.equal(overlaps(a, { ...a, start: "12:00", end: "13:00" }), false); // touching is fine
  assert.equal(overlaps(a, { ...a, venue_id: 2 }), false);
  assert.equal(overlaps(a, { ...a, date: "2026-10-31" }), false);
});

test("validation", () => {
  assert.equal(validateBookingInput(good, venue, now, hours).ok, true);
  const bad = (patch) => validateBookingInput({ ...good, ...patch }, venue, now, hours).ok;
  assert.equal(bad({ date: "2026-10-26" }), false);          // past
  assert.equal(bad({ end: "09:00" }), false);                 // end before start
  assert.equal(bad({ start: "06:00" }), false);               // before opening
  assert.equal(bad({ attendees: 501 }), false);               // over capacity
  assert.equal(bad({ attendees: "abc" }), false);
  assert.equal(bad({ event_name: "ab" }), false);
  assert.equal(bad({ date: "2026-02-31" }), false);           // impossible date
  assert.equal(validateBookingInput({ ...good, date: "2026-10-27", start: "09:00", end: "11:00" }, venue, now, hours).ok, false); // already started today
});

test("free slots", () => {
  const approved = [
    { venue_id: 1, date: "2026-10-30", start: "10:00", end: "12:00" },
    { venue_id: 1, date: "2026-10-30", start: "11:00", end: "14:00" },
    { venue_id: 2, date: "2026-10-30", start: "08:00", end: "21:00" },
  ];
  assert.deepEqual(freeSlots(approved, 1, "2026-10-30", hours), [
    { start: "07:00", end: "10:00" }, { start: "14:00", end: "22:00" },
  ]);
  assert.deepEqual(freeSlots([], 1, "2026-10-30", hours), [{ start: "07:00", end: "22:00" }]);
});

test("conflict groups", () => {
  const p = [
    { id: 1, venue_id: 1, date: "d", start: "10:00", end: "12:00", created_at: "2" },
    { id: 2, venue_id: 1, date: "d", start: "11:00", end: "13:00", created_at: "1" },
    { id: 3, venue_id: 1, date: "d", start: "15:00", end: "16:00", created_at: "1" },
    { id: 4, venue_id: 2, date: "d", start: "10:00", end: "12:00", created_at: "1" },
  ];
  const g = conflictGroups(p);
  assert.equal(g.length, 3);
  assert.deepEqual(g.find((x) => x.length === 2).map((b) => b.id), [2, 1]);
});
