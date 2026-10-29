import { useCallback, useEffect, useState } from "react";
import { api } from "../api.js";
import { longDate } from "../utils.js";
import { StatusChip } from "./MyBookings.jsx";

export default function Coordinator({ notify }) {
  const [view, setView] = useState("pending");
  const [clusters, setClusters] = useState(null);
  const [all, setAll] = useState(null);
  const [notes, setNotes] = useState({});

  const load = useCallback(() => {
    const p = view === "pending"
      ? api.pending().then((r) => setClusters(r.clusters))
      : api.allBookings().then((r) => setAll(r.bookings));
    p.catch((e) => notify(e.message, "error"));
  }, [view, notify]);
  useEffect(load, [load]);

  async function decide(kind, id) {
    try {
      const r = kind === "approve" ? await api.approve(id, notes[id] || "") : await api.reject(id, notes[id] || "");
      notify(r.message);
      load();
    } catch (e) {
      const slots = e.details?.freeSlots?.map((s) => `${s.start}–${s.end}`).join(", ");
      notify(e.message + (slots ? ` Free slots: ${slots}` : ""), "error");
      load();
    }
  }

  return (
    <div>
      <div className="tabs">
        <button className={view === "pending" ? "active" : ""} onClick={() => setView("pending")}>Pending requests</button>
        <button className={view === "all" ? "active" : ""} onClick={() => setView("all")}>All bookings</button>
      </div>

      {view === "pending" && (!clusters ? <div className="muted">Loading…</div> :
        clusters.length === 0 ? <div className="card muted">No pending requests.</div> :
        clusters.map((c, i) => (
          <div key={i} className={`card ${c.items.length > 1 ? "conflict" : ""}`}>
            <b>{c.items.length > 1 ? `⚠ ${c.items.length} requests overlap — approve one, the rest are rejected` : "Single request"}</b>
            {c.approvedClash && <div className="toast error">This overlaps an already approved booking, so it cannot be approved.</div>}
            <div className="scroll">
              <table>
                <thead><tr><th>Event</th><th>Requested by</th><th>Venue / time</th><th>Attendees</th><th>Decision</th></tr></thead>
                <tbody>
                  {c.items.map((b) => (
                    <tr key={b.id}>
                      <td><b>{b.event.name}</b><br /><small>{b.event.purpose}</small></td>
                      <td>{b.organizer_email}</td>
                      <td>{b.venue.name}<br />{longDate(b.date)}<br />{b.start}–{b.end}</td>
                      <td>{b.event.attendees}</td>
                      <td>
                        <input placeholder="Note to organiser (optional)" value={notes[b.id] || ""}
                          onChange={(e) => setNotes({ ...notes, [b.id]: e.target.value })} />
                        <div className="inline">
                          <button className="ok" disabled={c.approvedClash} onClick={() => decide("approve", b.id)}>Approve</button>
                          <button className="danger" onClick={() => decide("reject", b.id)}>Reject</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )))}

      {view === "all" && (!all ? <div className="muted">Loading…</div> : (
        <div className="card scroll">
          <table>
            <thead><tr><th>Event</th><th>By</th><th>Venue / time</th><th>Status</th></tr></thead>
            <tbody>
              {all.map((b) => (
                <tr key={b.id}>
                  <td>{b.event.name}</td><td>{b.organizer_email}</td>
                  <td>{b.venue.name}<br />{b.date} {b.start}–{b.end}</td>
                  <td><StatusChip s={b.status} />{b.decision_note && <div><small>{b.decision_note}</small></div>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
