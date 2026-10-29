
import { useCallback, useEffect, useState } from "react";
import { api } from "./api.js";
import Login from "./components/Login.jsx";
import BookingForm from "./components/BookingForm.jsx";
import CalendarView from "./components/CalendarView.jsx";
import MyBookings from "./components/MyBookings.jsx";
import Coordinator from "./components/Coordinator.jsx";

export default function App() {
  const [user, setUser] = useState(undefined);
  const [venues, setVenues] = useState([]);
  const [hours, setHours] = useState({
    open: "07:00",
    close: "22:00",
  });
  const [tab, setTab] = useState("calendar");
  const [toast, setToast] = useState(null);

  const notify = useCallback((text, type = "ok") => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 6000);
  }, []);

  // Restore the login only if this tab's session is active.
  useEffect(() => {
    const loggedIn =
      sessionStorage.getItem("campusconnect_logged_in") === "true";

    if (!loggedIn) {
      api.logout()
        .catch(() => {})
        .finally(() => setUser(null));
      return;
    }

    api.me()
      .then((r) => setUser(r.user))
      .catch(() => {
        sessionStorage.removeItem("campusconnect_logged_in");
        setUser(null);
      });
  }, []);

  // Load venues after successful login.
  useEffect(() => {
    if (!user) return;

    api.venues()
      .then((r) => {
        setVenues(r.venues);
        setHours(r.hours);
      })
      .catch((e) => notify(e.message, "error"));
  }, [user, notify]);

  async function handleLogin(loggedInUser) {
    sessionStorage.setItem("campusconnect_logged_in", "true");
    setUser(loggedInUser);
  }

  async function logout() {
    await api.logout().catch(() => {});
    sessionStorage.removeItem("campusconnect_logged_in");
    setUser(null);
    setTab("calendar");
  }

  if (user === undefined) {
    return <div className="center muted">Loading…</div>;
  }

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  const tabs = [
    ["calendar", "Calendar"],
    ["book", "Request a venue"],
    ["mine", "My bookings"],
  ];

  if (user.role === "coordinator") {
    tabs.push(["coord", "Coordinator"]);
  }

  return (
    <>
      <header className="top">
        <div className="brand">
          Campus<span>Connect</span>
          <small>NMAMIT Event Management</small>
        </div>

        <nav>
          {tabs.map(([key, label]) => (
            <button
              key={key}
              className={tab === key ? "active" : ""}
              onClick={() => setTab(key)}
            >
              {label}
            </button>
          ))}
        </nav>

        <div className="who">
          <span>
            {user.email}
            {user.role === "coordinator" ? " · Coordinator" : ""}
          </span>
          <button className="ghost" onClick={logout}>
            Logout
          </button>
        </div>
      </header>

      <main>
        {toast && (
          <div className={`toast ${toast.type}`} role="status">
            {toast.text}
          </div>
        )}

        {tab === "calendar" && (
          <CalendarView venues={venues} hours={hours} />
        )}

        {tab === "book" && (
          <BookingForm
            venues={venues}
            hours={hours}
            notify={notify}
            onCreated={() => setTab("mine")}
          />
        )}

        {tab === "mine" && <MyBookings notify={notify} />}

        {tab === "coord" && user.role === "coordinator" && (
          <Coordinator notify={notify} />
        )}
      </main>
    </>
  );
}
