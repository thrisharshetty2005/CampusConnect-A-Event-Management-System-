import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const list = (v, d = "") => (v ?? d).split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);

export const config = {
  port: Number(process.env.PORT || 4000),
  isProd: process.env.NODE_ENV === "production",
  clientOrigin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
  jwtSecret: process.env.JWT_SECRET || "",
  otpSecret: process.env.OTP_SECRET || process.env.JWT_SECRET || "",
  allowedDomains: list(process.env.ALLOWED_EMAIL_DOMAINS, "nmamit.in,nitte.edu.in"),
  coordinators: list(process.env.COORDINATOR_EMAILS),
  excelPath: path.resolve(here, "..", process.env.EXCEL_PATH || "data/campusconnect.xlsx"),
  mail: {
  mode: process.env.MAIL_MODE || "smtp",
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 465),
  secure: String(process.env.SMTP_SECURE ?? "true") === "true",
  user: process.env.SMTP_USER,
  pass: process.env.SMTP_PASS,
  from:
    process.env.MAIL_FROM_EMAIL ||
    process.env.MAIL_FROM ||
    process.env.SMTP_USER,
  fromName: process.env.MAIL_FROM_NAME || "CampusConnect",
  brevoApiKey: process.env.BREVO_API_KEY,
},
  otp: { ttlMin: 10, maxAttempts: 5, resendCooldownSec: 60, maxPerHour: 5 },
  hours: { open: "07:00", close: "22:00" }, // bookable window each day
};

if (config.jwtSecret.length < 32) {
  throw new Error("JWT_SECRET is missing or too short. Set a 32+ character random value in backend/.env");
}
if (config.isProd && config.mail.mode === "console") {
  throw new Error("MAIL_MODE=console is not allowed in production.");
}
if (config.mail.mode === "smtp" && (!config.mail.host || !config.mail.user || !config.mail.pass)) {
  console.warn("[config] SMTP_HOST / SMTP_USER / SMTP_PASS are not set - OTP emails cannot be sent yet.");
}
