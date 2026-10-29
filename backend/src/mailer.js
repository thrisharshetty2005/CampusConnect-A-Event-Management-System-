import nodemailer from "nodemailer";
import { config } from "./config.js";

let transporter;
function getTransporter() {
  if (!transporter) {
    const m = config.mail;
    transporter = nodemailer.createTransport({
      host: m.host,
      port: m.port,
      secure: m.secure,
      requireTLS: !m.secure,
      auth: { user: m.user, pass: m.pass },
    });
  }
  return transporter;
}

export async function sendMail({ to, subject, text }) {
  if (config.mail.mode === "console") {
    console.log(`\n[MAIL:console] To: ${to}\nSubject: ${subject}\n${text}\n`);
    return;
  }
  await getTransporter().sendMail({ from: config.mail.from, to, subject, text });
}

/** Best-effort notification: never lets an email problem break a booking action. */
export function notify(to, subject, text) {
  sendMail({ to, subject, text }).catch((e) => console.error("[mail] notification failed:", e.message));
}

export async function checkMail() {
  if (config.mail.mode === "console") return console.warn("[mail] CONSOLE mode: OTPs are printed, not emailed.");
  try {
    await getTransporter().verify();
    console.log("[mail] SMTP connection OK");
  } catch (e) {
    console.error("[mail] SMTP check failed - OTP emails will not be delivered:", e.message);
  }
}
