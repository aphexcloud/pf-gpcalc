// pages/api/inventory.js

export default async function handler(req, res) {
  try {
    // --- DYNAMIC IMPORT STRATEGY ---
    // We import the library inside the handler using 'await import'.
    // This bypasses build-time bundling issues entirely by forcing a fresh load at runtime.
    const square = await import("square");
    
    // Attempt to find the Client class in default or named exports
    const Client = square.Client || square.default?.Client;

    if (!Client) {
       console.error("Available exports:", Object.keys(square));
       throw new Error("Could not load Square Client class");
    }

    const client = new Client({
      accessToken: process.env.SQUARE_ACCESS_TOKEN,
      environment: process.env.SQUARE_ENVIRONMENT === 'production' 
        ? "production" 
        : "sandbox",
    });

    // 1. Fetch Catalog Items (Price & Cost)
    const catalogResponse = await client.catalogApi.listCatalog(undefined, 'ITEM,ITEM_VARIATION');
    
    // 2. Fetch Inventory Counts
    const itemIds = catalogResponse.result.objects
        ?.filter(obj => obj.type === 'ITEM_VARIATION')
        .map(obj => obj.id) || [];

    let inventoryCounts = [];
    if (itemIds.length > 0) {
        const inventoryResponse = await client.inventoryApi.batchRetrieveInventoryCounts({
          catalogObjectIds: itemIds
        });
        inventoryCounts = inventoryResponse.result.counts || [];
    }

    // 3. Merge Data (Simplified logic)
    const mergedData = catalogResponse.result.objects
      ?.filter(obj => obj.type === 'ITEM') // Get top level items
      .map(item => {
        const variations = item.itemData.variations;
        
        return variations.map(variation => {
            const price = Number(variation.itemVariationData.priceMoney?.amount || 0) / 100;
            const cost = 0; // Placeholder for cost
            
            // Find inventory for this specific variation
            const stockData = inventoryCounts.find(c => c.catalogObjectId === variation.id);
            const stockCount = stockData ? Number(stockData.quantity) : 0;
            const lastSold = stockData?.state === 'SOLD' ? stockData.calculatedAt : null;
            
            return {
                id: variation.id,
                name: `${item.itemData.name} - ${variation.itemVariationData.name}`,
                price_money: price,
                cost_money: cost,
                sku: variation.itemVariationData.sku,
                stock_count: stockCount,
                last_sold_at: lastSold
            };
        });
      }).flat() || [];

    res.status(200).json(mergedData);
  } catch (error) {
    console.error("API Handler Error:", error);
    res.status(500).json({ error: "Failed to fetch Square data" });
  }
}