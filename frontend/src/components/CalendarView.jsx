import { useEffect, useMemo, useState } from "react";
import { api } from "../api.js";
import { addDays, dayLabel, freeSlots, mondayOf, toMin, todayStr } from "../utils.js";

const PX_PER_HOUR = 44;

export default function CalendarView({ venues, hours }) {
  const [venueId, setVenueId] = useState("");
  const [weekStart, setWeekStart] = useState(mondayOf(todayStr()));
  const [bookings, setBookings] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => { if (!venueId && venues.length) setVenueId(String(venues[0].id)); }, [venues, venueId]);

  useEffect(() => {
    if (!venueId) return;
    let live = true;
    setError("");
    api.calendar(venueId, weekStart, addDays(weekStart, 6))
      .then((r) => live && setBookings(r.bookings))
      .catch((e) => live && setError(e.message));
    return () => { live = false; };
  }, [venueId, weekStart]);

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const openMin = toMin(hours.open), closeMin = toMin(hours.close);
  const height = ((closeMin - openMin) / 60) * PX_PER_HOUR;
  const hourMarks = Array.from({ length: Math.floor((closeMin - openMin) / 60) + 1 }, (_, i) => openMin / 60 + i);
  const today = todayStr();

  return (
    <div className="card">
      <div className="cal-head">
        <h2>Shared calendar</h2>
        <select value={venueId} onChange={(e) => setVenueId(e.target.value)}>
          {venues.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
        </select>
        <div className="pager">
          <button className="ghost" onClick={() => setWeekStart(addDays(weekStart, -7))}>‹ Prev</button>
          <button className="ghost" onClick={() => setWeekStart(mondayOf(todayStr()))}>This week</button>
          <button className="ghost" onClick={() => setWeekStart(addDays(weekStart, 7))}>Next ›</button>
        </div>
      </div>
      {error && <div className="toast error">{error}</div>}
      <div className="legend">
        <span><i className="sw approved" /> Approved</span>
        <span><i className="sw pending" /> Requested (pending)</span>
        <span><i className="sw mine" /> Your booking</span>
        <span className="muted">Empty space = available</span>
      </div>

      <div className="scroll">
        <div className="week" style={{ minWidth: 760 }}>
          <div className="time-col" style={{ height: height + 30 }}>
            {hourMarks.map((h) => (
              <div key={h} className="tick" style={{ top: 30 + (h * 60 - openMin) / 60 * PX_PER_HOUR }}>
                {String(h).padStart(2, "0")}:00
              </div>
            ))}
          </div>
          {days.map((d) => (
            <div key={d} className={`day ${d === today ? "today" : ""}`}>
              <div className="day-head">{dayLabel(d)}</div>
              <div className="day-body" style={{ height }}>
                {bookings.filter((b) => b.date === d).map((b) => (
                  <div key={b.id}
                    className={`block ${b.status === "Approved" ? "approved" : "pending"} ${b.mine ? "mine" : ""}`}
                    style={{ top: (toMin(b.start) - openMin) / 60 * PX_PER_HOUR, height: Math.max(18, (toMin(b.end) - toMin(b.start)) / 60 * PX_PER_HOUR - 2) }}
                    title={`${b.title}\n${b.start}–${b.end}`}>
                    <b>{b.start}–{b.end}</b><br />{b.title}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <h3>Available slots this week</h3>
      <div className="slots">
        {days.map((d) => {
          const approved = bookings.filter((b) => b.date === d && b.status === "Approved");
          const free = freeSlots(approved, hours);
          return (
            <div key={d}><b>{dayLabel(d)}</b>{" "}
              {d < today ? <span className="muted">past</span> :
                free.length ? free.map((s, i) => <span key={i} className="chip static">{s.start}–{s.end}</span>) :
                  <span className="muted">fully booked</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
