import { Router } from "express";
import { config } from "../config.js";
import { ah, HttpError } from "../errors.js";
import { read, write } from "../excel.js";
import { requireAuth, requireCoordinator } from "../auth.js";
import { conflictGroups, freeSlots, overlaps, toMin, localDate } from "../rules.js";
import { joinBookings, nowIso } from "../services.js";
import { notify } from "../mailer.js";

const router = Router();
router.use(requireAuth, requireCoordinator);   // every route below is coordinator-only

router.get("/pending", ah(async (_req, res) => {
  const today = localDate(new Date());
  const clusters = await read((db) => {
    const all = db.all("Bookings");
    const pending = all.filter((b) => b.status === "Pending" && b.date >= today);
    const approved = all.filter((b) => b.status === "Approved");
    return conflictGroups(pending).map((group) => ({
      approvedClash: group.some((p) => approved.some((a) => overlaps(a, p))),
      items: joinBookings(db, group, { withOrganizer: true }),
    }));
  });
  res.json({ clusters });
}));

router.get("/bookings", ah(async (req, res) => {
  const status = String(req.query.status || "");
  const bookings = await read((db) => {
    let rows = db.all("Bookings");
    if (status) rows = rows.filter((b) => b.status === status);
    rows.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    return joinBookings(db, rows.slice(0, 300), { withOrganizer: true });
  });
  res.json({ bookings });
}));

router.post("/bookings/:id/approve", ah(async (req, res) => {
  const note = String(req.body?.note ?? "").trim().slice(0, 300);
  const emails = [];
  const rejected = await write((db) => {
    const b = db.get("Bookings", Number(req.params.id));
    if (!b) throw new HttpError(404, "Booking not found.");
    if (b.status !== "Pending") throw new HttpError(409, "This request has already been decided.");

    const all = db.all("Bookings");
    const approved = all.filter((x) => x.status === "Approved");
    // Conflict prevention: re-checked here, inside the locked read-modify-write.
    if (approved.some((a) => overlaps(a, b)))
      throw new HttpError(409, "Cannot approve: it overlaps an already approved booking for this venue.", {
        freeSlots: freeSlots(approved, b.venue_id, b.date, config.hours),
      });

    db.update("Bookings", b.id, { status: "Approved", decision_note: note, decided_by: req.user.id, updated_at: nowIso() });
    const event = db.get("Events", b.event_id);
    const venue = db.get("Venues", b.venue_id);
    const owner = db.get("Users", b.user_id);
    if (owner) emails.push([owner.email, "Booking approved",
      `Your booking for "${event?.name}" at ${venue?.name} on ${b.date}, ${b.start}-${b.end} is APPROVED.${note ? `\nNote: ${note}` : ""}`]);

    // Reject every other pending request that overlaps the approved slot and suggest alternatives.
    const nowApproved = [...approved, { ...b, status: "Approved" }];
    const losers = all.filter((x) => x.status === "Pending" && x.id !== b.id && overlaps(x, b));
    for (const o of losers) {
      const need = toMin(o.end) - toMin(o.start);
      const alt = freeSlots(nowApproved, o.venue_id, o.date, config.hours, need)
        .map((s) => `${s.start}-${s.end}`).join(", ");
      const text = `Another event was approved for this slot.${alt ? ` Free slots that day: ${alt}.` : " No free slot of that length remains that day."}`;
      db.update("Bookings", o.id, { status: "Rejected", decision_note: text, decided_by: req.user.id, updated_at: nowIso() });
      const oe = db.get("Events", o.event_id);
      const ou = db.get("Users", o.user_id);
      if (ou) emails.push([ou.email, "Booking request not approved",
        `Your request for "${oe?.name}" at ${venue?.name} on ${o.date}, ${o.start}-${o.end} was not approved.\n${text}`]);
    }
    return losers.length;
  });
  emails.forEach(([to, subject, text]) => notify(to, subject, text));
  res.json({ ok: true, rejected, message: `Approved. ${rejected} conflicting request(s) rejected with alternative slots suggested.` });
}));

router.post("/bookings/:id/reject", ah(async (req, res) => {
  const note = String(req.body?.note ?? "").trim().slice(0, 300);
  const mail = [];
  await write((db) => {
    const b = db.get("Bookings", Number(req.params.id));
    if (!b) throw new HttpError(404, "Booking not found.");
    if (b.status !== "Pending") throw new HttpError(409, "This request has already been decided.");
    db.update("Bookings", b.id, { status: "Rejected", decision_note: note, decided_by: req.user.id, updated_at: nowIso() });
    const e = db.get("Events", b.event_id), u = db.get("Users", b.user_id), v = db.get("Venues", b.venue_id);
    if (u) mail.push([u.email, "Booking request not approved",
      `Your request for "${e?.name}" at ${v?.name} on ${b.date}, ${b.start}-${b.end} was not approved.${note ? `\nReason: ${note}` : ""}`]);
  });
  mail.forEach(([to, s, t]) => notify(to, s, t));
  res.json({ ok: true, message: "Request rejected." });
}));

export default router;
