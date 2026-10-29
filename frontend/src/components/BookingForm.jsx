import { useEffect, useState } from "react";
import { api } from "../api.js";
import { todayStr } from "../utils.js";

export default function BookingForm({ venues, hours, notify, onCreated }) {
  const [f, setF] = useState({ venue_id: "", date: todayStr(), start: "", end: "", event_name: "", purpose: "", attendees: "" });
  const [avail, setAvail] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const venue = venues.find((v) => String(v.id) === String(f.venue_id));

  useEffect(() => {
    if (!f.venue_id || !f.date) { setAvail(null); return; }
    let live = true;
    api.availability(f.venue_id, f.date).then((r) => live && setAvail(r)).catch(() => live && setAvail(null));
    return () => { live = false; };
  }, [f.venue_id, f.date]);

  async function submit(e) {
    e.preventDefault();
    setError(null); setBusy(true);
    try {
      const r = await api.createBooking({ ...f, venue_id: Number(f.venue_id), attendees: Number(f.attendees) });
      notify(r.message);
      onCreated();
    } catch (err) {
      setError(err);
      if (f.venue_id) api.availability(f.venue_id, f.date).then(setAvail).catch(() => {});
    } finally { setBusy(false); }
  }

  const pick = (s) => setF({ ...f, start: s.start, end: s.end });

  return (
    <div className="grid2">
      <form className="card" onSubmit={submit}>
        <h2>Request a venue</h2>
        <p className="muted">Requests are reviewed by a faculty coordinator. Nothing is confirmed automatically.</p>
        {error && (
          <div className="toast error">
            {error.message}
            {error.details?.freeSlots?.length > 0 && (
              <div>Free slots that day: {error.details.freeSlots.map((s) => `${s.start}–${s.end}`).join(", ")}</div>
            )}
          </div>
        )}
        <label>Venue
          <select required value={f.venue_id} onChange={set("venue_id")}>
            <option value="">Select an auditorium or channel…</option>
            {["Auditorium", "Channel"].map((t) => (
              <optgroup key={t} label={t === "Channel" ? "Channels" : "Auditoriums"}>
                {venues.filter((v) => v.type === t).map((v) => (
                  <option key={v.id} value={v.id}>{v.name} (capacity {v.capacity})</option>
                ))}
              </optgroup>
            ))}
            {venues.filter((v) => !["Auditorium", "Channel"].includes(v.type)).map((v) => (
              <option key={v.id} value={v.id}>{v.name} (capacity {v.capacity})</option>
            ))}
          </select>
        </label>
        <label>Event name
          <input required minLength={3} maxLength={120} value={f.event_name} onChange={set("event_name")} />
        </label>
        <label>Event purpose
          <textarea required minLength={5} maxLength={1000} rows={3} value={f.purpose} onChange={set("purpose")} />
        </label>
        <div className="row3">
          <label>Date
            <input type="date" required min={todayStr()} value={f.date} onChange={set("date")} />
          </label>
          <label>Start
            <input type="time" required min={hours.open} max={hours.close} value={f.start} onChange={set("start")} />
          </label>
          <label>End
            <input type="time" required min={hours.open} max={hours.close} value={f.end} onChange={set("end")} />
          </label>
        </div>
        <label>Expected attendees {venue && <small className="muted">(max {venue.capacity})</small>}
          <input type="number" required min={1} max={venue?.capacity} value={f.attendees} onChange={set("attendees")} />
        </label>
        <button disabled={busy}>{busy ? "Submitting…" : "Submit request"}</button>
      </form>

      <aside className="card">
        <h3>Availability on {f.date || "…"}</h3>
        {!venue && <p className="muted">Choose a venue to see what is already booked.</p>}
        {venue && avail && (
          <>
            <h4>Booked (approved)</h4>
            {avail.busy.length === 0 ? <p className="muted">Nothing approved yet.</p> :
              <ul>{avail.busy.map((b, i) => <li key={i}>{b.start}–{b.end}</li>)}</ul>}
            <h4>Free slots <small className="muted">(click to use)</small></h4>
            {avail.free.length === 0 ? <p className="muted">No free slots.</p> :
              <div className="chips">{avail.free.map((s, i) => (
                <button type="button" key={i} className="chip" onClick={() => pick(s)}>{s.start}–{s.end}</button>))}</div>}
          </>
        )}
      </aside>
    </div>
  );
}
