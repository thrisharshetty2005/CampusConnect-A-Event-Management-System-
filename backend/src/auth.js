import jwt from "jsonwebtoken";
import { config } from "./config.js";
import { HttpError } from "./errors.js";

export const COOKIE = "cc_session";

export const normalizeEmail = (e) => String(e || "").trim().toLowerCase();

export function isCollegeEmail(email) {
  if (email.length > 120 || !/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(email)) return false;
  const domain = email.split("@")[1];
  return config.allowedDomains.some((d) => domain === d || domain.endsWith(`.${d}`));
}

// The coordinator list lives ONLY in the server environment - never trusted from the client or the token.
export const isCoordinator = (email) => config.coordinators.includes(email);

export function setSession(res, user) {
  const token = jwt.sign({ sub: user.id, email: user.email }, config.jwtSecret, {
    expiresIn: "8h",
    issuer: "campusconnect",
  });
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: config.isProd,
    maxAge: 8 * 3600_000,
  });
}

export function requireAuth(req, _res, next) {
  try {
    const p = jwt.verify(req.cookies?.[COOKIE] || "", config.jwtSecret, { issuer: "campusconnect" });
    req.user = {
      id: Number(p.sub),
      email: p.email,
      name: p.email.split("@")[0],
      role: isCoordinator(p.email) ? "coordinator" : "user",
    };
    next();
  } catch {
    next(new HttpError(401, "Please verify your college email to continue."));
  }
}

export function requireCoordinator(req, _res, next) {
  if (req.user?.role !== "coordinator") return next(new HttpError(403, "Only faculty coordinators can do this."));
  next();
}
