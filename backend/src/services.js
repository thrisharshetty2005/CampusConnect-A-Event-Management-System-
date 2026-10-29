/** Attach event / venue / organiser details to booking rows. */
export function joinBookings(db, bookings, { withOrganizer = false } = {}) {
  const events = new Map(db.all("Events").map((e) => [Number(e.id), e]));
  const venues = new Map(db.all("Venues").map((v) => [Number(v.id), v]));
  const users = new Map(db.all("Users").map((u) => [Number(u.id), u]));
  return bookings.map((b) => {
    const e = events.get(Number(b.event_id)) || {};
    const v = venues.get(Number(b.venue_id)) || {};
    const out = {
      id: b.id,
      status: b.status,
      date: b.date,
      start: b.start,
      end: b.end,
      decision_note: b.decision_note || "",
      created_at: b.created_at,
      venue_id: b.venue_id,
      venue: { id: v.id, name: v.name, type: v.type },
      event: { name: e.name, purpose: e.purpose, attendees: e.attendees },
    };
    if (withOrganizer) out.organizer_email = users.get(Number(b.user_id))?.email || "";
    return out;
  });
}

export const nowIso = () => new Date().toISOString();
