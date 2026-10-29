import { Router } from "express";
import { config } from "../config.js";
import { ah, HttpError } from "../errors.js";
import { read, write } from "../excel.js";
import { requireAuth } from "../auth.js";
import { freeSlots, overlaps, validateBookingInput, isDate } from "../rules.js";
import { joinBookings, nowIso } from "../services.js";

const router = Router();
const activeVenue = (v) => v && String(v.active ?? "yes").toLowerCase() !== "no";

router.get("/venues", requireAuth, ah(async (_req, res) => {
  const venues = await read((db) => db.all("Venues").filter(activeVenue)
    .map(({ id, name, type, capacity, location }) => ({ id, name, type, capacity, location })));
  res.json({ venues, hours: config.hours });
}));

// Shared calendar: approved bookings (with event name) + pending requests (anonymous) for one venue.
router.get("/calendar", requireAuth, ah(async (req, res) => {
  const venueId = Number(req.query.venue_id);
  const { from, to } = req.query;
  if (!isDate(from) || !isDate(to) || from > to) throw new HttpError(400, "Invalid date range.");
  if ((new Date(to) - new Date(from)) / 86400000 > 31) throw new HttpError(400, "Range too large (max 31 days).");
  const bookings = await read((db) => {
    const rows = db.all("Bookings").filter((b) =>
      Number(b.venue_id) === venueId && ["Approved", "Pending"].includes(b.status) && b.date >= from && b.date <= to);
    const events = new Map(db.all("Events").map((e) => [Number(e.id), e]));
    return rows.map((b) => ({
      id: b.id, date: b.date, start: b.start, end: b.end, status: b.status,
      mine: Number(b.user_id) === req.user.id,
      title: b.status === "Approved" ? events.get(Number(b.event_id))?.name || "Booked" : "Requested (pending)",
    }));
  });
  res.json({ bookings });
}));

router.get("/availability", requireAuth, ah(async (req, res) => {
  const venueId = Number(req.query.venue_id);
  const date = String(req.query.date || "");
  if (!isDate(date)) throw new HttpError(400, "Invalid date.");
  const out = await read((db) => {
    const approved = db.all("Bookings").filter((b) => b.status === "Approved"
      && Number(b.venue_id) === venueId && b.date === date);
    return { busy: approved.map((b) => ({ start: b.start, end: b.end })), free: freeSlots(approved, venueId, date, config.hours) };
  });
  res.json(out);
}));

router.post("/bookings", requireAuth, ah(async (req, res) => {
  const result = await write((db) => {
    const venue = db.get("Venues", Number(req.body?.venue_id));
    if (!activeVenue(venue)) throw new HttpError(400, "Please choose a venue from the list.");
    const v = validateBookingInput(req.body || {}, venue, new Date(), config.hours);
    if (!v.ok) throw new HttpError(400, v.error);
    const val = v.value;

    const all = db.all("Bookings");
    if (all.filter((b) => b.user_id === req.user.id && b.status === "Pending").length >= 10)
      throw new HttpError(429, "You already have 10 pending requests. Cancel some before adding more.");

    const approved = all.filter((b) => b.status === "Approved");
    if (approved.some((b) => overlaps(b, val)))
      throw new HttpError(409, "That time overlaps an already approved booking for this venue.", {
        freeSlots: freeSlots(approved, val.venue_id, val.date, config.hours),
      });

    const event = db.insert("Events", {
      name: val.event_name, purpose: val.purpose, attendees: val.attendees,
      organizer_id: req.user.id, created_at: nowIso(),
    });
    const booking = db.insert("Bookings", {
      event_id: event.id, venue_id: val.venue_id, user_id: req.user.id,
      date: val.date, start: val.start, end: val.end, status: "Pending",
      decision_note: "", decided_by: null, created_at: nowIso(), updated_at: nowIso(),
    });
    // Never auto-confirm: even a free slot waits for the coordinator.
    const competing = all.filter((b) => b.status === "Pending" && overlaps(b, val)).length;
    return { booking, competing };
  });
  res.status(201).json({
    id: result.booking.id,
    status: "Pending",
    message: result.competing
      ? `Request submitted. ${result.competing} other request(s) overlap this slot - the coordinator will decide.`
      : "Request submitted. It is pending coordinator approval.",
  });
}));

router.get("/bookings/mine", requireAuth, ah(async (req, res) => {
  const bookings = await read((db) => {
    const mine = db.all("Bookings").filter((b) => b.user_id === req.user.id)
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    return joinBookings(db, mine);
  });
  res.json({ bookings });
}));

router.post("/bookings/:id/cancel", requireAuth, ah(async (req, res) => {
  await write((db) => {
    const b = db.get("Bookings", Number(req.params.id));
    if (!b) throw new HttpError(404, "Booking not found.");
    if (b.user_id !== req.user.id && req.user.role !== "coordinator") throw new HttpError(403, "This is not your booking.");
    if (!["Pending", "Approved"].includes(b.status)) throw new HttpError(409, "Only pending or approved bookings can be cancelled.");
    db.update("Bookings", b.id, { status: "Cancelled", updated_at: nowIso() });
  });
  res.json({ ok: true, message: "Booking cancelled." });
}));

export default router;
