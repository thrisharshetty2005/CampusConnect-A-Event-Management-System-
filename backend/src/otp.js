import crypto from "node:crypto";
import { config } from "./config.js";

// email -> { hash, expires, attempts }   (kept in memory only; only a keyed hash of the OTP is stored)
const codes = new Map();
// email -> [timestamps of sent codes]
const sent = new Map();

const hmac = (email, code) =>
  crypto.createHmac("sha256", config.otpSecret).update(`${email}:${code}`).digest();

export function canSend(email) {
  const now = Date.now();
  const log = (sent.get(email) || []).filter((t) => now - t < 3600_000);
  sent.set(email, log);
  const last = log[log.length - 1];
  if (last && now - last < config.otp.resendCooldownSec * 1000)
    return { ok: false, retryAfter: Math.ceil((config.otp.resendCooldownSec * 1000 - (now - last)) / 1000) };
  if (log.length >= config.otp.maxPerHour) return { ok: false, retryAfter: 3600 };
  return { ok: true };
}

export function issue(email) {
  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
  codes.set(email, { hash: hmac(email, code), expires: Date.now() + config.otp.ttlMin * 60_000, attempts: 0 });
  if (!sent.has(email)) sent.set(email, []);
  sent.get(email).push(Date.now());
  return code;
}

export function discard(email) {
  codes.delete(email);
  const log = sent.get(email);
  if (log) log.pop();
}

export function check(email, code) {
  const entry = codes.get(email);
  if (!entry || entry.expires < Date.now()) {
    codes.delete(email);
    return { ok: false, reason: "That code has expired. Request a new one." };
  }
  if (!/^\d{6}$/.test(code)) return { ok: false, reason: "Enter the 6-digit code." };
  entry.attempts += 1;
  const ok = crypto.timingSafeEqual(entry.hash, hmac(email, code));
  if (ok) {
    codes.delete(email); // single use
    return { ok: true };
  }
  if (entry.attempts >= config.otp.maxAttempts) {
    codes.delete(email);
    return { ok: false, reason: "Too many wrong attempts. Request a new code." };
  }
  return { ok: false, reason: `Incorrect code. ${config.otp.maxAttempts - entry.attempts} attempt(s) left.` };
}

setInterval(() => {
  const now = Date.now();
  for (const [k, v] of codes) if (v.expires < now) codes.delete(k);
}, 60_000).unref();
