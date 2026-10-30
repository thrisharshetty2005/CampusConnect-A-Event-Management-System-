
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

async function sendBrevoMail({ to, subject, text }) {
  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": config.mail.brevoApiKey,
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: JSON.stringify({
      sender: {
        name: config.mail.fromName,
        email: config.mail.from,
      },
      to: [{ email: to }],
      subject,
      textContent: text,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Brevo API error (${response.status}): ${error}`);
  }

  console.log("[mail] Email sent successfully through Brevo");
}

export async function sendMail({ to, subject, text }) {
  if (config.mail.mode === "console") {
    console.log(`[MAIL:console] To: ${to}\nSubject: ${subject}\n${text}`);
    return;
  }

  if (config.mail.mode === "brevo") {
    await sendBrevoMail({ to, subject, text });
    return;
  }

  await getTransporter().sendMail({
    from: config.mail.from,
    to,
    subject,
    text,
  });
}

export function notify(to, subject, text) {
  sendMail({ to, subject, text }).catch((e) =>
    console.error("[mail] notification failed:", e.message)
  );
}

export async function checkMail() {
  if (config.mail.mode === "console") {
    return console.warn("[mail] CONSOLE mode: OTPs are printed, not emailed.");
  }

  if (config.mail.mode === "brevo") {
    console.log("[mail] Brevo API mode configured");
    return;
  }

  try {
    await getTransporter().verify();
    console.log("[mail] SMTP connection OK");
  } catch (e) {
    console.error("[mail] SMTP check failed:", e.message);
  }
}
