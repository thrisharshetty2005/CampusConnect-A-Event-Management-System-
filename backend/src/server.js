import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import { config } from "./config.js";
import { HttpError, StoreBusyError } from "./errors.js";
import { initStore } from "./excel.js";
import { checkMail } from "./mailer.js";
import authRoutes from "./routes/auth.js";
import bookingRoutes from "./routes/bookings.js";
import coordinatorRoutes from "./routes/coordinator.js";

const app = express();
app.disable("x-powered-by");
app.use(helmet());
app.use(cors({ origin: config.clientOrigin, credentials: true }));
app.use(express.json({ limit: "20kb" }));
app.use(cookieParser());

app.use("/api", rateLimit({ windowMs: 15 * 60_000, limit: 400, standardHeaders: true, legacyHeaders: false }));
app.use("/api/auth", rateLimit({ windowMs: 15 * 60_000, limit: 40, standardHeaders: true, legacyHeaders: false,
  message: { error: "Too many attempts. Please wait a few minutes." } }));

app.use("/api/auth", authRoutes);
app.use("/api/coordinator", coordinatorRoutes);
app.use("/api", bookingRoutes);
app.use("/api", (_req, _res, next) => next(new HttpError(404, "Not found.")));

// Optional: serve the built React app (npm run build in /frontend) from this same server.
const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../frontend/dist");
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get("*", (_req, res) => res.sendFile(path.join(dist, "index.html")));
}

app.use((err, _req, res, _next) => {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message, details: err.details });
  if (err instanceof StoreBusyError) return res.status(503).json({ error: err.message });
  if (err?.type === "entity.parse.failed") return res.status(400).json({ error: "Invalid JSON." });
  console.error(err);
  res.status(500).json({ error: "Something went wrong on the server." });
});

await initStore();
await checkMail();
app.listen(config.port, () => console.log(`CampusConnect API running on http://localhost:${config.port}`));
