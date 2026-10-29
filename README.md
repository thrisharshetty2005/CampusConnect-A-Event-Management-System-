# CampusConnect - NMAMIT Event Management System
React (Vite) frontend + Node.js/Express backend + Microsoft Excel (ExcelJS) as the data store.

```
CampusConnect-React/
  backend/    Express API (src/server.js), Excel store (src/excel.js), OTP, mailer, routes
  frontend/   React app (src/App.jsx + src/components/*)
  .vscode/    tasks.json  (Terminal > Run Task > "Start CampusConnect (both)")
```

## 1. Prerequisites
- Node.js 18+ (LTS from nodejs.org). Check: `node -v`
- A mailbox that can send email by SMTP (see step 3)

## 2. Install
Open the `CampusConnect-React` folder in VS Code, then in two terminals:

```
cd backend
npm install
copy .env.example .env      (Mac/Linux: cp .env.example .env)
```
```
cd frontend
npm install
```

## 3. Configure `backend/.env` (secrets live only here - never commit it)
1. Generate two secrets and paste them as `JWT_SECRET` and `OTP_SECRET`:
   `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`
2. `COORDINATOR_EMAILS` = the faculty coordinators' college emails (comma separated). Only they can approve/reject.
3. Email (real OTP) - choose one:
   - **Gmail**: turn on 2-Step Verification, create an *App Password* (Google Account > Security > App passwords), then
     `SMTP_HOST=smtp.gmail.com  SMTP_PORT=465  SMTP_SECURE=true  SMTP_USER=<gmail>  SMTP_PASS=<16-char app password>`
   - **Microsoft 365 / Outlook**: `SMTP_HOST=smtp.office365.com  SMTP_PORT=587  SMTP_SECURE=false` (SMTP AUTH must be enabled by the admin)
   - **College / other SMTP** (Brevo, SendGrid, Zoho...): use the host/port/user/password they give you.
   - Local testing without email: `MAIL_MODE=console` prints the OTP in the backend terminal (blocked when `NODE_ENV=production`).

## 4. Run
- VS Code: Terminal > Run Task > **Start CampusConnect (both)**, or run `npm run dev` in `backend` and in `frontend`.
- Open http://localhost:5173

On first start the backend creates `backend/data/campusconnect.xlsx` with sheets
**Venues, Users, Events, Bookings** and 4 sample venues.

## Excel data (edit the Venues sheet!)
| Sheet | What it holds |
|---|---|
| Venues | id, name, type (`Auditorium` or `Channel`), capacity, location, active (`yes`/`no`) - **replace the sample rows with the official list** |
| Users | verified users (created at first successful OTP login) |
| Events | event name, purpose, expected attendees, organiser |
| Bookings | venue, date, start, end, status (Pending / Approved / Rejected / Cancelled), coordinator note |

Keep the workbook **closed in Excel while the server is running**; if it is open, saving fails and the app shows "Excel data file is open in another program".
Do not rename sheets or the header row. Edit Venues while the server is stopped, or just save and close - it is re-read on every request.

## How the rules work
1. **OTP**: only `@nmamit.in` / `@nitte.edu.in` (and subdomains). 6-digit code by email, valid 10 min, single use, 5 wrong attempts then lock, 60 s resend cooldown, max 5 per hour per email. Only a keyed hash of the code is held in server memory. A successful check sets an httpOnly session cookie (8 h); every booking API needs it.
2. **Booking**: a new request is always **Pending**. It is refused at once (409, with free slots) if it overlaps an already **Approved** booking.
3. **Overlapping Pending requests** stay Pending and are shown to coordinators as a conflict group.
4. **Approval** (coordinator only; the coordinator list comes from the server `.env`, not from the browser): re-checks approved bookings inside a locked read-modify-write, approves one, rejects the other overlapping requests with suggested free slots, and emails the people concerned.
5. **Cancel**: owners can cancel their Pending/Approved bookings. **Calendar**: shared weekly view per venue (approved, pending, your own) plus free slots.
6. All Excel access runs one-at-a-time through a queue and is saved atomically (temp file then rename).

## Tests
`cd backend && npm test` - unit tests for overlap, validation, free slots and conflict grouping.

## Production notes
`NODE_ENV=production` (HTTPS needed for the secure cookie), `npm run build` in `frontend` (the backend then serves `frontend/dist`), set `CLIENT_ORIGIN`, keep `.env` out of git. Excel suits a department-scale load; move to a real database if usage grows.
