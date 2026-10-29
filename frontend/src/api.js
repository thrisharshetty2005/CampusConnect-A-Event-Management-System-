async function request(path, { method = "GET", body } = {}) {
  const res = await fetch(`/api${path}`, {
    method,
    credentials: "include",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch { /* empty body */ }
  if (!res.ok) {
    const err = new Error(data?.error || `Request failed (${res.status})`);
    err.status = res.status;
    err.details = data?.details;
    throw err;
  }
  return data;
}

const qs = (o) => new URLSearchParams(o).toString();

export const api = {
  requestOtp: (email) => request("/auth/request-otp", { method: "POST", body: { email } }),
  verifyOtp: (email, otp) => request("/auth/verify-otp", { method: "POST", body: { email, otp } }),
  me: () => request("/auth/me"),
  logout: () => request("/auth/logout", { method: "POST" }),
  venues: () => request("/venues"),
  calendar: (venue_id, from, to) => request(`/calendar?${qs({ venue_id, from, to })}`),
  availability: (venue_id, date) => request(`/availability?${qs({ venue_id, date })}`),
  createBooking: (b) => request("/bookings", { method: "POST", body: b }),
  myBookings: () => request("/bookings/mine"),
  cancel: (id) => request(`/bookings/${id}/cancel`, { method: "POST" }),
  pending: () => request("/coordinator/pending"),
  allBookings: (status = "") => request(`/coordinator/bookings${status ? `?status=${status}` : ""}`),
  approve: (id, note) => request(`/coordinator/bookings/${id}/approve`, { method: "POST", body: { note } }),
  reject: (id, note) => request(`/coordinator/bookings/${id}/reject`, { method: "POST", body: { note } }),
};
