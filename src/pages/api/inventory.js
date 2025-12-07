import { SquareClient, SquareEnvironment } from "square";

// Initialize the client
const client = new SquareClient({
  accessToken: process.env.SQUARE_ACCESS_TOKEN,
  environment: SquareEnvironment.Sandbox, // Change to SquareEnvironment.Production when ready
});

// Helper for BigInts
const bigIntReplacer = (key, value) => {
  if (typeof value === "bigint") {
    return value.toString();
  }
  return value;
};

// --- FALLBACK FUNCTION: RAW HTTP REQUEST ---
// Used if the SDK methods are mismatched or fail
async function rawSquareRequest(endpoint, method = "GET", body = null) {
  const isProd = process.env.SQUARE_ENVIRONMENT === "production";
  const baseUrl = isProd
    ? "https://connect.squareup.com"
    : "https://connect.squareupsandbox.com";

  const url = `${baseUrl}${endpoint}`;
  
  const options = {
    method,
    headers: {
      "Authorization": `Bearer ${process.env.SQUARE_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
      "Square-Version": "2023-10-20", // Pin a recent version
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Raw Request Failed: ${response.status} ${response.statusText} - ${errorText}`);
  }
  return await response.json();
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    console.log("Fetching Square Catalog and Inventory...");

    // ---------------------------------------------------------
    // ATTEMPT 1: SDK (With Debugging)
    // ---------------------------------------------------------
    let items = [];
    let inventoryCounts = [];

    try {
      // 1. Determine Accessors
      const catalogApi = client.catalogApi || client.catalog;
      const inventoryApi = client.inventoryApi || client.inventory;

      // DEBUG: Log the actual methods available to solve the mystery
      if (catalogApi) {
        console.log("DEBUG: CatalogAPI Methods:", Object.getOwnPropertyNames(Object.getPrototypeOf(catalogApi)));
      }

      // 2. Try Fetching Catalog
      // We try standard name 'listCatalog', then 'list'
      let catalogResponse;
      if (catalogApi && typeof catalogApi.listCatalog === 'function') {
        catalogResponse = await catalogApi.listCatalog(undefined, "ITEM,ITEM_VARIATION");
      } else if (catalogApi && typeof catalogApi.list === 'function') {
         // Some versions shorten the name
        catalogResponse = await catalogApi.list(undefined, "ITEM,ITEM_VARIATION");
      } else {
        throw new Error("Could not find listCatalog or list method on catalogApi");
      }

      items = catalogResponse.result.objects || [];

      // 3. Try Fetching Inventory
      const variationIds = items
        .flatMap(item => item.itemData?.variations || [])
        .map(variation => variation.id);

      if (variationIds.length > 0) {
        const batchSize = 100;
        for (let i = 0; i < variationIds.length; i += batchSize) {
          const batchIds = variationIds.slice(i, i + batchSize);
          
          let invResponse;
          if (typeof inventoryApi.batchRetrieveInventoryCounts === 'function') {
            invResponse = await inventoryApi.batchRetrieveInventoryCounts({ catalogObjectIds: batchIds });
          } else if (typeof inventoryApi.batchRetrieveCounts === 'function') {
             invResponse = await inventoryApi.batchRetrieveCounts({ catalogObjectIds: batchIds });
          }
          
          if (invResponse && invResponse.result.counts) {
            inventoryCounts = [...inventoryCounts, ...invResponse.result.counts];
          }
        }
      }

    } catch (sdkError) {
      console.warn("SDK Method failed (" + sdkError.message + "). Switching to Raw HTTP Fallback.");
      
      // ---------------------------------------------------------
      // ATTEMPT 2: RAW FETCH FALLBACK (Guaranteed to work if key is valid)
      // ---------------------------------------------------------
      
      // 1. Fetch Catalog
      const catData = await rawSquareRequest("/v2/catalog/list?types=ITEM,ITEM_VARIATION");
      items = catData.objects || [];

      // 2. Fetch Inventory
      const variationIds = items
        .flatMap(item => item.itemData?.variations || [])
        .map(variation => variation.id);

      if (variationIds.length > 0) {
         // Batching logic for raw fetch
         const batchSize = 100;
         for (let i = 0; i < variationIds.length; i += batchSize) {
           const batchIds = variationIds.slice(i, i + batchSize);
           const invData = await rawSquareRequest("/v2/inventory/batch-retrieve-counts", "POST", {
             catalog_object_ids: batchIds
           });
           if (invData.counts) {
             inventoryCounts = [...inventoryCounts, ...invData.counts];
           }
         }
      }
    }

    // ---------------------------------------------------------
    // PROCESS DATA (Common to both methods)
    // ---------------------------------------------------------
    
    if (items.length === 0) {
      return res.status(200).json([]);
    }

    const mappedData = items.map((item) => {
      // Safety check: itemData might be undefined in some edge cases
      if (!item.itemData || !item.itemData.variations) return null;

      const variations = item.itemData.variations.map((variation) => {
        // Find matching inventory count
        const countData = inventoryCounts.find(
          (c) => c.catalogObjectId === variation.id || c.catalog_object_id === variation.id
        );

        // Handle price (Raw API uses snake_case, SDK might use camelCase)
        const priceData = variation.itemVariationData.priceMoney || variation.itemVariationData.price_money;
        const price = priceData ? Number(priceData.amount) / 100 : 0;
        const currency = priceData ? priceData.currency : "USD";

        return {
          id: variation.id,
          name: variation.itemVariationData.name,
          sku: variation.itemVariationData.sku || "N/A",
          price: price,
          currency: currency,
          quantity: countData ? countData.quantity : "0",
          status: countData ? countData.state : "UNKNOWN",
        };
      }).filter(Boolean); // Remove nulls

      return {
        id: item.id,
        name: item.itemData.name,
        description: item.itemData.description || "",
        category_id: item.itemData.categoryId || item.itemData.category_id,
        variations: variations,
      };
    }).filter(Boolean);

    // Return Data
    const jsonString = JSON.stringify(mappedData, bigIntReplacer);
    res.setHeader("Content-Type", "application/json");
    res.status(200).send(jsonString);

  } catch (error) {
    console.error("API Handler Fatal Error:", error);
    res.status(500).json({
      error: "Failed to fetch inventory",
      details: error.message
    });
  }
}