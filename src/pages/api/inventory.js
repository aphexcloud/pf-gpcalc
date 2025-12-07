// Square Inventory API with extended data
// Fetches: catalog items, inventory counts, tax info, cost prices, and last sold dates

const bigIntReplacer = (key, value) => {
  if (typeof value === "bigint") {
    return value.toString();
  }
  return value;
};

async function rawSquareRequest(endpoint, token, isProd, method = "GET", body = null) {
  const baseUrl = isProd
    ? "https://connect.squareup.com"
    : "https://connect.squareupsandbox.com";

  const url = `${baseUrl}${endpoint}`;

  const options = {
    method,
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
      "Square-Version": "2024-01-18",
    },
    cache: "no-store",
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);
  if (!response.ok) {
    const txt = await response.text();
    throw new Error(`Square API Failed: ${response.status} - ${txt}`);
  }
  return response.json();
}

// Fetch all catalog objects with pagination
async function fetchAllCatalogObjects(token, isProd) {
  let allObjects = [];
  let cursor = null;

  do {
    const endpoint = cursor
      ? `/v2/catalog/list?types=ITEM,TAX&cursor=${cursor}`
      : `/v2/catalog/list?types=ITEM,TAX`;

    const data = await rawSquareRequest(endpoint, token, isProd);
    if (data.objects) {
      allObjects = [...allObjects, ...data.objects];
    }
    cursor = data.cursor;
  } while (cursor);

  return allObjects;
}

// Get inventory counts for variations
async function getInventoryCounts(variationIds, token, isProd) {
  const countsMap = {};

  for (let i = 0; i < variationIds.length; i += 100) {
    const batchIds = variationIds.slice(i, i + 100);

    try {
      const data = await rawSquareRequest(
        "/v2/inventory/batch-retrieve-counts",
        token,
        isProd,
        "POST",
        { catalog_object_ids: batchIds }
      );

      if (data.counts) {
        for (const count of data.counts) {
          const objId = count.catalog_object_id;
          if (objId) {
            countsMap[objId] = Number(count.quantity) || 0;
          }
        }
      }
    } catch (err) {
      console.log("Could not fetch inventory counts:", err.message);
    }
  }

  return countsMap;
}

// Get last sold dates from inventory changes
async function getLastSoldDates(variationIds, token, isProd) {
  const lastSoldMap = {};

  for (let i = 0; i < variationIds.length; i += 100) {
    const batchIds = variationIds.slice(i, i + 100);

    try {
      const data = await rawSquareRequest(
        "/v2/inventory/changes/batch-retrieve",
        token,
        isProd,
        "POST",
        {
          catalog_object_ids: batchIds,
          types: ["ADJUSTMENT"],
          states: ["SOLD"]
        }
      );

      if (data.changes) {
        for (const change of data.changes) {
          const objId = change.adjustment?.catalog_object_id;
          const occurredAt = change.adjustment?.occurred_at;

          if (objId && occurredAt) {
            if (!lastSoldMap[objId] || new Date(occurredAt) > new Date(lastSoldMap[objId])) {
              lastSoldMap[objId] = occurredAt;
            }
          }
        }
      }
    } catch (err) {
      console.log("Could not fetch inventory changes:", err.message);
    }
  }

  return lastSoldMap;
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const rawToken = process.env.SQUARE_ACCESS_TOKEN || "";
  const envToken = rawToken.trim().replace(/^["']|["']$/g, '');

  const rawEnv = process.env.SQUARE_ENVIRONMENT || "sandbox";
  const isProduction = rawEnv.toLowerCase().includes("production");

  if (!envToken) {
    return res.status(500).json({ error: "Missing SQUARE_ACCESS_TOKEN" });
  }

  try {
    console.log(`Fetching Square Catalog (Mode: ${isProduction ? 'Production' : 'Sandbox'})...`);

    // 1. Fetch all catalog objects (items and taxes)
    const allObjects = await fetchAllCatalogObjects(envToken, isProduction);

    const items = allObjects.filter(obj => obj.type === 'ITEM');
    const taxes = allObjects.filter(obj => obj.type === 'TAX');

    console.log(`Found ${items.length} items and ${taxes.length} taxes`);

    // Create tax lookup map (using snake_case from API response)
    const taxMap = {};
    for (const tax of taxes) {
      taxMap[tax.id] = {
        name: tax.tax_data?.name || 'Unknown Tax',
        percentage: tax.tax_data?.percentage || '0',
        enabled: tax.tax_data?.enabled !== false
      };
    }

    // 2. Get all variation IDs
    const variationIds = items
      .filter(item => item.item_data?.variations)
      .flatMap(item => item.item_data.variations.map(v => v.id));

    console.log(`Found ${variationIds.length} variations`);

    // 3. Fetch inventory counts
    const inventoryCounts = await getInventoryCounts(variationIds, envToken, isProduction);

    // 4. Fetch last sold dates
    const lastSoldMap = await getLastSoldDates(variationIds, envToken, isProduction);

    // 5. Merge all data
    const mergedData = items
      .filter(item => !item.item_data?.is_archived) // Filter out archived items
      .map(item => {
        if (!item.item_data || !item.item_data.variations) return [];

        // Get tax info for this item (using snake_case)
        const itemTaxIds = item.item_data.tax_ids || [];
        const hasTax = itemTaxIds.length > 0;
        const taxInfo = itemTaxIds.map(id => taxMap[id]).filter(Boolean);
        const gstEnabled = hasTax && taxInfo.some(t => t.enabled);

        return item.item_data.variations.map(variation => {
          const varData = variation.item_variation_data || {};

          // Get sell price
          let sellPrice = 0;
          if (varData.price_money?.amount) {
            sellPrice = Number(varData.price_money.amount) / 100;
          }

          // Get cost price from default_unit_cost or vendor info
          let costPrice = null;
          if (varData.default_unit_cost?.amount) {
            costPrice = Number(varData.default_unit_cost.amount) / 100;
          } else if (varData.item_variation_vendor_infos?.length > 0) {
            // Use the first vendor's price if no default cost
            const vendorInfo = varData.item_variation_vendor_infos[0];
            if (vendorInfo.item_variation_vendor_info_data?.price_money?.amount) {
              costPrice = Number(vendorInfo.item_variation_vendor_info_data.price_money.amount) / 100;
            }
          }

          const stockCount = inventoryCounts[variation.id] || 0;
          const lastSoldAt = lastSoldMap[variation.id] || null;

          // Variation name - use empty string as "Regular"
          const variationName = varData.name || 'Regular';

          return {
            id: variation.id,
            itemId: item.id,
            name: item.item_data.name,
            variationName: variationName === '' ? 'Regular' : variationName,
            fullName: `${item.item_data.name}${variationName && variationName !== 'Regular' ? ' - ' + variationName : ''}`,
            price: sellPrice,
            costPrice: costPrice,
            sku: varData.sku || "",
            stockCount: stockCount,
            lastSoldAt: lastSoldAt,
            gstEnabled: gstEnabled,
            taxInfo: taxInfo,
            trackInventory: varData.track_inventory || false,
          };
        });
      }).flat();

    console.log(`Returning ${mergedData.length} items`);

    const jsonString = JSON.stringify(mergedData, bigIntReplacer);
    res.setHeader("Content-Type", "application/json");
    res.status(200).send(jsonString);

  } catch (error) {
    console.error("API Error:", error);
    res.status(500).json({ error: error.message });
  }
}
