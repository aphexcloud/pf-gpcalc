// Square Inventory API with Caching
// Serves inventory from cache for instant load times
// Cache is synced in the background every 30 minutes

import { getCachedInventory, getCachedMerchant, getSyncStatus } from '@/lib/inventory-cache';
import { syncInventoryFromSquare } from '@/lib/square-sync';

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const status = getSyncStatus();

    // If cache is empty, do initial sync
    if (!status.isCached) {
      console.log('[INVENTORY] Cache empty, performing initial sync...');
      const syncResult = await syncInventoryFromSquare();

      if (!syncResult.success) {
        return res.status(500).json({ error: syncResult.error || 'Failed to sync inventory' });
      }
    }

    // Serve from cache
    const items = getCachedInventory();
    const merchant = getCachedMerchant();
    const lastSync = getSyncStatus().lastSync;

    console.log(`[INVENTORY] Serving ${items.length} cached items (last sync: ${new Date(lastSync).toLocaleString()})`);

    res.status(200).json({
      merchant: merchant,
      items: items,
      cached: true,
      lastSync: lastSync
    });

  } catch (error) {
    console.error("[INVENTORY] Error:", error);
    res.status(500).json({ error: error.message });
  }
}
