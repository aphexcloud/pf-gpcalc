// Background Sync Service
// Automatically syncs inventory from Square every 30 minutes

import { syncInventoryFromSquare } from './square-sync.js';
import { getSyncStatus } from './inventory-cache.js';

const SYNC_INTERVAL = 30 * 60 * 1000; // 30 minutes in milliseconds

let syncTimer = null;
let isRunning = false;

/**
 * Perform background sync
 */
async function performBackgroundSync() {
  if (isRunning) {
    console.log('[BACKGROUND-SYNC] Sync already in progress, skipping...');
    return;
  }

  try {
    isRunning = true;
    console.log('[BACKGROUND-SYNC] Starting scheduled sync...');

    const result = await syncInventoryFromSquare();

    if (result.success) {
      console.log(`[BACKGROUND-SYNC] ✓ Synced ${result.itemCount} items in ${result.duration}s`);
    } else {
      console.error(`[BACKGROUND-SYNC] ✗ Sync failed: ${result.error}`);
    }
  } catch (error) {
    console.error('[BACKGROUND-SYNC] Error:', error);
  } finally {
    isRunning = false;
  }
}

/**
 * Start background sync timer
 */
export function startBackgroundSync() {
  if (syncTimer) {
    console.log('[BACKGROUND-SYNC] Already running');
    return;
  }

  console.log(`[BACKGROUND-SYNC] Started (interval: ${SYNC_INTERVAL / 1000 / 60} minutes)`);

  // Check if we need an initial sync
  const status = getSyncStatus();
  if (!status.isCached) {
    console.log('[BACKGROUND-SYNC] No cache found, performing initial sync...');
    performBackgroundSync();
  } else {
    console.log(`[BACKGROUND-SYNC] Cache exists (${status.itemCount} items, last sync: ${new Date(status.lastSync).toLocaleString()})`);
  }

  // Schedule periodic syncs
  syncTimer = setInterval(performBackgroundSync, SYNC_INTERVAL);

  // Prevent Node.js from keeping the process alive just for this timer
  if (syncTimer.unref) {
    syncTimer.unref();
  }
}

/**
 * Stop background sync timer
 */
export function stopBackgroundSync() {
  if (syncTimer) {
    clearInterval(syncTimer);
    syncTimer = null;
    console.log('[BACKGROUND-SYNC] Stopped');
  }
}

/**
 * Get sync status
 */
export function getBackgroundSyncStatus() {
  return {
    enabled: syncTimer !== null,
    isRunning: isRunning,
    interval: SYNC_INTERVAL,
    ...getSyncStatus()
  };
}

// Auto-start on module load (server-side only)
if (typeof window === 'undefined') {
  // Delay start to allow server to initialize
  setTimeout(() => {
    startBackgroundSync();
  }, 5000); // Start 5 seconds after server start
}
