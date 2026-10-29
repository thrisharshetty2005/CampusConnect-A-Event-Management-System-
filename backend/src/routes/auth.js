import { Router } from "express";
import { config } from "../config.js";
import { ah, HttpError } from "../errors.js";
import { read, write } from "../excel.js";
import { isCollegeEmail, isCoordinator, normalizeEmail, setSession, COOKIE, requireAuth } from "../auth.js";
import { sendMail } from "../mailer.js";
import * as otp from "../otp.js";
import { nowIso } from "../services.js";

const router = Router();

router.post("/request-otp", ah(async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  if (!isCollegeEmail(email))
    throw new HttpError(400, "Please use your NMAMIT / Nitte college email address.");
  const gate = otp.canSend(email);
  if (!gate.ok) throw new HttpError(429, `Please wait ${gate.retryAfter}s before requesting another code.`);

  const code = otp.issue(email);
  try {
    await sendMail({
      to: email,
      subject: "Your CampusConnect verification code",
      text:
        `Your CampusConnect verification code is ${code}\n\n` +
        `It is valid for ${config.otp.ttlMin} minutes. If you did not request it, ignore this email.`,
    });
  } catch (e) {
    otp.discard(email);
    console.error("[mail] OTP send failed:", e.message);
    throw new HttpError(502, "We could not send the email right now. Please try again shortly.");
  }
  res.json({ ok: true, expiresInMin: config.otp.ttlMin, resendAfterSec: config.otp.resendCooldownSec });
}));

router.post("/verify-otp", ah(async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const code = String(req.body?.otp ?? "").trim();
  if (!isCollegeEmail(email)) throw new HttpError(400, "Invalid email.");
  const result = otp.check(email, code);
  if (!result.ok) throw new HttpError(401, result.reason);

  const role = isCoordinator(email) ? "coordinator" : "user";
  const user = await write((db) => {
    const existing = db.all("Users").find((u) => u.email === email);
    if (existing) {
      db.update("Users", existing.id, { role, last_login: nowIso() });
      return { ...existing, role };
    }
    return db.insert("Users", {
      email, name: email.split("@")[0], role, verified_at: nowIso(), last_login: nowIso(),
    });
  });
  setSession(res, user);
  res.json({ user: { id: user.id, email, name: user.name, role } });
}));

router.get("/me", requireAuth, (req, res) => {
  const { id, email, name, role } = req.user;
  res.json({ user: { id, email, name, role } });
});

router.post("/logout", (_req, res) => {
  res.clearCookie(COOKIE);
  res.json({ ok: true });
});

export default router;
