// Database helper for last sold dates
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const DATA_DIR = process.env.DATA_DIR || '/app/data';
const dbPath = path.join(DATA_DIR, "auth.db");

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Get database connection
function getDb() {
  const db = new Database(dbPath, { fileMustExist: false });
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 30000');
  return db;
}

/**
 * Get all last sold dates from database
 * @returns {Object} Map of variation_id -> last_sold_at date string
 */
export function getAllLastSoldDates() {
  const db = getDb();
  try {
    const stmt = db.prepare('SELECT variation_id, last_sold_at FROM last_sold');
    const rows = stmt.all();

    const lastSoldMap = {};
    for (const row of rows) {
      lastSoldMap[row.variation_id] = row.last_sold_at;
    }

    return lastSoldMap;
  } catch (err) {
    console.error('[LAST-SOLD-DB] Error reading last sold dates:', err.message);
    return {};
  } finally {
    db.close();
  }
}

/**
 * Get last sold date for a specific variation
 * @param {string} variationId
 * @returns {string|null} Last sold date or null
 */
export function getLastSoldDate(variationId) {
  const db = getDb();
  try {
    const stmt = db.prepare('SELECT last_sold_at FROM last_sold WHERE variation_id = ?');
    const row = stmt.get(variationId);
    return row ? row.last_sold_at : null;
  } catch (err) {
    console.error('[LAST-SOLD-DB] Error reading last sold date:', err.message);
    return null;
  } finally {
    db.close();
  }
}

/**
 * Update or insert last sold date for a variation
 * @param {string} variationId
 * @param {string} lastSoldAt ISO date string
 */
export function upsertLastSoldDate(variationId, lastSoldAt) {
  const db = getDb();
  try {
    const stmt = db.prepare(`
      INSERT INTO last_sold (variation_id, last_sold_at, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(variation_id)
      DO UPDATE SET
        last_sold_at = excluded.last_sold_at,
        updated_at = excluded.updated_at
      WHERE datetime(excluded.last_sold_at) > datetime(last_sold_at)
    `);

    const now = Date.now();
    stmt.run(variationId, lastSoldAt, now);
  } catch (err) {
    console.error('[LAST-SOLD-DB] Error upserting last sold date:', err.message);
  } finally {
    db.close();
  }
}

/**
 * Bulk update last sold dates
 * @param {Object} lastSoldMap Map of variation_id -> last_sold_at date string
 * @returns {number} Number of records updated
 */
export function bulkUpsertLastSoldDates(lastSoldMap) {
  const db = getDb();
  try {
    const stmt = db.prepare(`
      INSERT INTO last_sold (variation_id, last_sold_at, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(variation_id)
      DO UPDATE SET
        last_sold_at = excluded.last_sold_at,
        updated_at = excluded.updated_at
      WHERE datetime(excluded.last_sold_at) > datetime(last_sold_at)
    `);

    const now = Date.now();
    const transaction = db.transaction((entries) => {
      for (const [variationId, lastSoldAt] of entries) {
        stmt.run(variationId, lastSoldAt, now);
      }
    });

    const entries = Object.entries(lastSoldMap);
    transaction(entries);

    console.log(`[LAST-SOLD-DB] Updated ${entries.length} last sold dates in database`);
    return entries.length;
  } catch (err) {
    console.error('[LAST-SOLD-DB] Error bulk upserting last sold dates:', err.message);
    return 0;
  } finally {
    db.close();
  }
}

/**
 * Delete last sold date for a variation
 * @param {string} variationId
 */
export function deleteLastSoldDate(variationId) {
  const db = getDb();
  try {
    const stmt = db.prepare('DELETE FROM last_sold WHERE variation_id = ?');
    stmt.run(variationId);
  } catch (err) {
    console.error('[LAST-SOLD-DB] Error deleting last sold date:', err.message);
  } finally {
    db.close();
  }
}

/**
 * Get count of records in last_sold table
 * @returns {number}
 */
export function getLastSoldCount() {
  const db = getDb();
  try {
    const stmt = db.prepare('SELECT COUNT(*) as count FROM last_sold');
    const row = stmt.get();
    return row.count;
  } catch (err) {
    console.error('[LAST-SOLD-DB] Error counting last sold records:', err.message);
    return 0;
  } finally {
    db.close();
  }
}
