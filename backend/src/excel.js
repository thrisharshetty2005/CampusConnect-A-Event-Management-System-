// Excel-backed data store (ExcelJS). One workbook, one sheet per table, row 1 = headers.
import fs from "node:fs/promises";
import path from "node:path";
import ExcelJS from "exceljs";
import { config } from "./config.js";
import { StoreBusyError } from "./errors.js";

export const SCHEMA = {
  Venues: ["id", "name", "type", "capacity", "location", "active"],
  Users: ["id", "email", "name", "role", "verified_at", "last_login"],
  Events: ["id", "name", "purpose", "attendees", "organizer_id", "created_at"],
  Bookings: ["id", "event_id", "venue_id", "user_id", "date", "start", "end", "status",
             "decision_note", "decided_by", "created_at", "updated_at"],
};
const TEXT_COLS = new Set(["date", "start", "end"]); // keep as text so Excel never reformats them

const SEED_VENUES = [
  [1, "Ampitheatre Open Air Auditorium", "Auditorium", 2500, "NMAMIT Campus", "yes"],
  [2, "Sambhram Auditorium", "Auditorium", 350, "NMAMIT Campus", "yes"],
  [3, "Shambhavi Auditorium", "Auditorium", 150, "NMAMIT Campus", "yes"],
  [4, "Sowparnika Seminar Hall", "Seminar Hall", 100, "NMAMIT Campus", "yes"],
  [5, "Phalguni Seminar Hall", "Seminar Hall", 100, "NMAMIT Campus", "yes"],
  [6, "Netravati Seminar Hall", "Seminar Hall", 125, "NMAMIT Campus", "yes"],
  [7, "Nandini Seminar Hall", "Seminar Hall", 50, "NMAMIT Campus", "yes"],
  [8, "Karyaagara Sabhangana", "Auditorium", 300, "NMAMIT Campus", "yes"],
];

const pad = (n) => String(n).padStart(2, "0");

/** Normalise whatever Excel hands back (rich text, dates, time fractions, formulas) to plain values. */
function normalise(col, v) {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) {
    if (col === "date") return v.toISOString().slice(0, 10);
    if (col === "start" || col === "end") return `${pad(v.getUTCHours())}:${pad(v.getUTCMinutes())}`;
    return v.toISOString();
  }
  if (typeof v === "object") {
    if (Array.isArray(v.richText)) return v.richText.map((r) => r.text).join("").trim();
    if ("result" in v) return normalise(col, v.result);
    if ("text" in v) return String(v.text).trim();
    return null;
  }
  if (typeof v === "number" && (col === "start" || col === "end") && v >= 0 && v < 1) {
    const mins = Math.round(v * 24 * 60);
    return `${pad(Math.floor(mins / 60))}:${pad(mins % 60)}`;
  }
  if (typeof v === "string") return v.trim();
  return v;
}

class Db {
  constructor(wb) {
    this.wb = wb;
  }
  all(sheet) {
    const ws = this.wb.getWorksheet(sheet);
    const cols = SCHEMA[sheet];
    const out = [];
    for (let r = 2; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      const obj = { _row: r };
      let empty = true;
      cols.forEach((c, i) => {
        const v = normalise(c, row.getCell(i + 1).value);
        if (v !== null && v !== "") empty = false;
        obj[c] = v;
      });
      if (!empty) out.push(obj);
    }
    return out;
  }
  get(sheet, id) {
    return this.all(sheet).find((r) => Number(r.id) === Number(id)) || null;
  }
  insert(sheet, data) {
    const ws = this.wb.getWorksheet(sheet);
    const cols = SCHEMA[sheet];
    const id = this.all(sheet).reduce((m, r) => Math.max(m, Number(r.id) || 0), 0) + 1;
    const rec = { ...data, id };
    const row = ws.getRow(ws.rowCount + 1);
    cols.forEach((c, i) => (row.getCell(i + 1).value = rec[c] ?? null));
    return { ...rec };
  }
  update(sheet, id, patch) {
    const ws = this.wb.getWorksheet(sheet);
    const cols = SCHEMA[sheet];
    const rec = this.get(sheet, id);
    if (!rec) throw new Error(`${sheet} #${id} not found`);
    const row = ws.getRow(rec._row);
    for (const [k, v] of Object.entries(patch)) {
      const i = cols.indexOf(k);
      if (i >= 0) row.getCell(i + 1).value = v ?? null;
    }
  }
}

// ---- serialise all access so two requests never read/modify/write at the same time ----
let chain = Promise.resolve();
function lock(fn) {
  const run = chain.then(() => fn());
  chain = run.catch(() => {});
  return run;
}

async function open() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(config.excelPath);
  return new Db(wb);
}


async function save(db) {
  const tmp = `${config.excelPath}.tmp`;

  try {
    await db.wb.xlsx.writeFile(tmp);

    // Replace the existing workbook with the updated temporary file.
    await fs.rename(tmp, config.excelPath);
  } catch (e) {
    console.error("[excel] Save failed:", {
      code: e.code,
      message: e.message,
      file: config.excelPath,
    });

    await fs.rm(tmp, { force: true }).catch(() => {});

    if (["EBUSY", "EPERM", "EACCES"].includes(e.code)) {
      throw new StoreBusyError(
        "Cannot save the Excel data file. Close LibreOffice or Excel and try again."
      );
    }

    throw e;
  }
}

/** Read-only access. fn(db) */
export const read = (fn) => lock(async () => fn(await open()));

/** Read-modify-write. If fn throws, nothing is saved (acts like a rollback). */
export const write = (fn) =>
  lock(async () => {
    const db = await open();
    const result = await fn(db);
    await save(db);
    return result;
  });

export async function initStore() {
  await fs.mkdir(path.dirname(config.excelPath), { recursive: true });
  const wb = new ExcelJS.Workbook();
  let existed = true;

try {
  await fs.access(config.excelPath);
  await wb.xlsx.readFile(config.excelPath);
} catch (e) {
  if (e.code !== "ENOENT") throw e;
  existed = false;
}
  let changed = !existed;
  for (const [name, cols] of Object.entries(SCHEMA)) {
    let ws = wb.getWorksheet(name);
    if (!ws) {
      ws = wb.addWorksheet(name);
      ws.addRow(cols);
      changed = true;
    }
    cols.forEach((c, i) => {
      const col = ws.getColumn(i + 1);
      col.width = Math.max(12, c.length + 6);
      if (TEXT_COLS.has(c)) col.numFmt = "@";
    });
    ws.getRow(1).font = { bold: true };
    ws.views = [{ state: "frozen", ySplit: 1 }];
  }
  const venues = wb.getWorksheet("Venues");
  if (venues.rowCount < 2) {
    SEED_VENUES.forEach((v) => venues.addRow(v));
    changed = true;
  }
  if (changed) {
    await wb.xlsx.writeFile(config.excelPath);
    console.log(`[excel] data file ready: ${config.excelPath}`);
  }
}
