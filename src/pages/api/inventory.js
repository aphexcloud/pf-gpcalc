// pages/api/inventory.js
// Use 'require' to prevent constructor errors in Docker environment
const { Client } = require("square");

const client = new Client({
  accessToken: process.env.SQUARE_ACCESS_TOKEN,
  environment: process.env.SQUARE_ENVIRONMENT === 'production' 
    ? "production" 
    : "sandbox",
});

export default async function handler(req, res) {
  try {
    // 1. Fetch Catalog Items (Price & Cost)
    const catalogResponse = await client.catalogApi.listCatalog(undefined, 'ITEM,ITEM_VARIATION');
    
    // 2. Fetch Inventory Counts
    // We safeguard this call in case there are no items yet
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
        // Find variations (SKUs)
        const variations = item.itemData.variations;
        
        return variations.map(variation => {
            const price = Number(variation.itemVariationData.priceMoney?.amount || 0) / 100;
            // Note: Cost is often stored in custom fields or strictly in Inventory API depending on your square setup
            const cost = 0; // You would fetch this from vendor management or custom attributes
            
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
                // ... map other fields
            };
        });
      }).flat() || [];

    res.status(200).json(mergedData);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch Square data" });
  }
}
