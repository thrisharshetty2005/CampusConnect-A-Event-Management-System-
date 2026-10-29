import { useCallback, useEffect, useState } from "react";
import { api } from "../api.js";
import { longDate } from "../utils.js";

export const StatusChip = ({ s }) => <span className={`chip-status ${s}`}>{s}</span>;

export default function MyBookings({ notify }) {
  const [rows, setRows] = useState(null);

  const load = useCallback(() => {
    api.myBookings().then((r) => setRows(r.bookings)).catch((e) => notify(e.message, "error"));
  }, [notify]);
  useEffect(load, [load]);

  async function cancel(id) {
    if (!window.confirm("Cancel this booking?")) return;
    try { const r = await api.cancel(id); notify(r.message); load(); }
    catch (e) { notify(e.message, "error"); }
  }

  if (!rows) return <div className="muted">Loading…</div>;
  return (
    <div className="card">
      <h2>My bookings</h2>
      {rows.length === 0 ? <p className="muted">You have not requested any venue yet.</p> : (
        <div className="scroll">
          <table>
            <thead><tr><th>Event</th><th>Venue</th><th>When</th><th>Status</th><th /></tr></thead>
            <tbody>
              {rows.map((b) => (
                <tr key={b.id}>
                  <td><b>{b.event.name}</b><br /><small className="muted">{b.event.purpose}</small></td>
                  <td>{b.venue.name}</td>
                  <td>{longDate(b.date)}<br />{b.start}–{b.end}</td>
                  <td><StatusChip s={b.status} />{b.decision_note && <div><small>{b.decision_note}</small></div>}</td>
                  <td>{["Pending", "Approved"].includes(b.status) &&
                    <button className="danger" onClick={() => cancel(b.id)}>Cancel</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
