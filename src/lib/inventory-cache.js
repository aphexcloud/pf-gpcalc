import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const DATA_DIR = process.env.DATA_DIR || '/app/data';

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const dbPath = path.join(DATA_DIR, "inventory-cache.db");

// Create database
const db = new Database(dbPath, { fileMustExist: false });

// Configure for performance
db.pragma('journal_mode = WAL');
db.pragma('busy_timeout = 30000');
db.pragma('synchronous = NORMAL');
db.pragma('cache_size = 2000');
db.pragma('foreign_keys = ON');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS inventory_cache (
    id TEXT PRIMARY KEY,
    itemId TEXT,
    name TEXT,
    variationName TEXT,
    fullName TEXT,
    price REAL,
    costPrice REAL,
    sku TEXT,
    stockCount INTEGER,
    lastSoldAt TEXT,
    isTaxable INTEGER,
    taxInfo TEXT,
    trackInventory INTEGER,
    updatedAt INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_name ON inventory_cache(name);
  CREATE INDEX IF NOT EXISTS idx_sku ON inventory_cache(sku);

  CREATE TABLE IF NOT EXISTS merchant_cache (
    id TEXT PRIMARY KEY,
    name TEXT,
    merchantId TEXT,
    country TEXT,
    updatedAt INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sync_metadata (
    key TEXT PRIMARY KEY,
    value TEXT,
    updatedAt INTEGER NOT NULL
  );
`);

/**
 * Get last sync timestamp
 */
export function getLastSyncTime() {
  try {
    const row = db.prepare("SELECT value FROM sync_metadata WHERE key = 'last_sync'").get();
    return row ? parseInt(row.value) : null;
  } catch (err) {
    console.error('Error getting last sync time:', err);
    return null;
  }
}

/**
 * Set last sync timestamp
 */
export function setLastSyncTime(timestamp = Date.now()) {
  try {
    db.prepare(`
      INSERT INTO sync_metadata (key, value, updatedAt)
      VALUES ('last_sync', ?, ?)
      ON CONFLICT(key) DO UPDATE SET value = ?, updatedAt = ?
    `).run(timestamp.toString(), timestamp, timestamp.toString(), timestamp);
  } catch (err) {
    console.error('Error setting last sync time:', err);
  }
}

/**
 * Get sync status
 */
export function getSyncStatus() {
  try {
    const lastSync = getLastSyncTime();
    const count = db.prepare("SELECT COUNT(*) as count FROM inventory_cache").get();
    const merchantCount = db.prepare("SELECT COUNT(*) as count FROM merchant_cache").get();

    return {
      lastSync,
      itemCount: count.count,
      hasMerchant: merchantCount.count > 0,
      isCached: count.count > 0
    };
  } catch (err) {
    console.error('Error getting sync status:', err);
    return {
      lastSync: null,
      itemCount: 0,
      hasMerchant: false,
      isCached: false
    };
  }
}

/**
 * Get all cached inventory items
 */
export function getCachedInventory() {
  try {
    const items = db.prepare("SELECT * FROM inventory_cache").all();

    // Parse JSON fields and convert integers back to booleans
    return items.map(item => ({
      ...item,
      isTaxable: Boolean(item.isTaxable),
      trackInventory: Boolean(item.trackInventory),
      taxInfo: item.taxInfo ? JSON.parse(item.taxInfo) : []
    }));
  } catch (err) {
    console.error('Error getting cached inventory:', err);
    return [];
  }
}

/**
 * Get cached merchant info
 */
export function getCachedMerchant() {
  try {
    const merchant = db.prepare("SELECT * FROM merchant_cache LIMIT 1").get();
    return merchant ? {
      name: merchant.name,
      id: merchant.merchantId,
      country: merchant.country
    } : null;
  } catch (err) {
    console.error('Error getting cached merchant:', err);
    return null;
  }
}

/**
 * Update inventory cache (replaces all data)
 */
export function updateInventoryCache(items, merchant) {
  const now = Date.now();

  try {
    // Use transaction for atomicity
    const transaction = db.transaction(() => {
      // Clear existing data
      db.prepare("DELETE FROM inventory_cache").run();
      db.prepare("DELETE FROM merchant_cache").run();

      // Insert merchant
      if (merchant) {
        db.prepare(`
          INSERT INTO merchant_cache (id, name, merchantId, country, updatedAt)
          VALUES ('default', ?, ?, ?, ?)
        `).run(merchant.name, merchant.id, merchant.country, now);
      }

      // Insert items
      const insertStmt = db.prepare(`
        INSERT INTO inventory_cache (
          id, itemId, name, variationName, fullName, price, costPrice,
          sku, stockCount, lastSoldAt, isTaxable, taxInfo, trackInventory, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const item of items) {
        insertStmt.run(
          item.id,
          item.itemId,
          item.name,
          item.variationName,
          item.fullName,
          item.price,
          item.costPrice,
          item.sku,
          item.stockCount,
          item.lastSoldAt,
          item.isTaxable ? 1 : 0,
          JSON.stringify(item.taxInfo || []),
          item.trackInventory ? 1 : 0,
          now
        );
      }

      // Update sync timestamp
      setLastSyncTime(now);
    });

    transaction();

    console.log(`✓ Cached ${items.length} items`);
    return true;
  } catch (err) {
    console.error('Error updating inventory cache:', err);
    return false;
  }
}

/**
 * Clear all cache
 */
export function clearCache() {
  try {
    db.prepare("DELETE FROM inventory_cache").run();
    db.prepare("DELETE FROM merchant_cache").run();
    db.prepare("DELETE FROM sync_metadata").run();
    console.log('✓ Cache cleared');
    return true;
  } catch (err) {
    console.error('Error clearing cache:', err);
    return false;
  }
}

// Start background sync on server initialization
if (typeof window === 'undefined') {
  import('./background-sync.js').catch(err => {
    console.error('Failed to start background sync:', err);
  });
}

export default db;
