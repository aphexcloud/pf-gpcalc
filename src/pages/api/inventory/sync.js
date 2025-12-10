// Manual sync endpoint - triggers immediate refresh from Square API
// Requires admin authentication

import { syncInventoryFromSquare } from '@/lib/square-sync';
import { getSyncStatus } from '@/lib/inventory-cache';
import { auth } from '@/lib/auth';

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Check authentication
    const session = await auth.api.getSession({ headers: req.headers });

    if (!session?.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Only admins can trigger manual sync
    if (session.user.role !== 'admin') {
      return res.status(403).json({ error: "Forbidden - Admin access required" });
    }

    console.log(`[SYNC] Manual sync triggered by ${session.user.email}`);

    // Perform sync
    const result = await syncInventoryFromSquare();

    if (result.success) {
      const status = getSyncStatus();

      return res.status(200).json({
        success: true,
        message: `Successfully synced ${result.itemCount} items`,
        itemCount: result.itemCount,
        duration: result.duration,
        lastSync: status.lastSync
      });
    } else {
      return res.status(500).json({
        success: false,
        error: result.error || 'Sync failed'
      });
    }

  } catch (error) {
    console.error("[SYNC] Error:", error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
