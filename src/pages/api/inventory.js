import { Client } from "square";

// FIX: Use strings "production" and "sandbox" directly instead of Environment.Production
// This prevents the "Cannot read properties of undefined" error.
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

    // 3. Merge Data
    const mergedData = catalogResponse.result.objects
      ?.filter(obj => obj.type === 'ITEM') // Get top level items
      .map(item => {
        const variations = item.itemData.variations;
        
        return variations.map(variation => {
            const price = Number(variation.itemVariationData.priceMoney?.amount || 0) / 100;
            const cost = 0; // Placeholder: Real cost requires the Vendors API or custom attributes
            
            // Find inventory for this specific variation
            const stockData = inventoryCounts.find(c => c.catalogObjectId === variation.id);
            const stockCount = stockData ? Number(stockData.quantity) : 0;
            const lastSold = stockData?.state === 'SOLD' ? stockData.calculatedAt : null;

            return {
                id: variation.id,
                name: `${item.itemData.name} - ${variation.itemVariationData.name}`,
                price_money: price,
                cost_money: cost,
                sku: variation.itemVariationData.sku || 'No SKU',
                stock_count: stockCount,
                last_sold_at: lastSold
            };
        });
      }).flat() || [];

    res.status(200).json(mergedData);
  } catch (error) {
    console.error("Square API Error:", error);
    // Return an empty list instead of crashing so the UI still loads
    res.status(500).json({ error: "Failed to fetch Square data" });
  }
}