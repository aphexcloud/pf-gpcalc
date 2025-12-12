// Square Sync Service - Fetches data from Square API and updates cache

import { updateInventoryCache } from './inventory-cache.js';

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
    options.body = JSON.stringify(body, bigIntReplacer);
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

// Get merchant locations
async function getMerchantLocations(token, isProd) {
  try {
    const data = await rawSquareRequest("/v2/locations", token, isProd);
    const locations = data.locations || [];
    console.log(`[SYNC] Found ${locations.length} locations:`, locations.map(l => `${l.name} (${l.id})`));
    return locations.map(loc => loc.id);
  } catch (err) {
    console.error("[SYNC] Could not fetch locations:", err.message);
    return [];
  }
}

// Get inventory counts for variations
async function getInventoryCounts(variationIds, locationIds, token, isProd) {
  const countsMap = {};

  for (let i = 0; i < variationIds.length; i += 100) {
    const batchIds = variationIds.slice(i, i + 100);

    try {
      const requestBody = {
        catalog_object_ids: batchIds,
        states: ["IN_STOCK"]  // Only count items that are IN_STOCK
      };

      // Include location_ids if available
      if (locationIds && locationIds.length > 0) {
        requestBody.location_ids = locationIds;
      }

      const data = await rawSquareRequest(
        "/v2/inventory/batch-retrieve-counts",
        token,
        isProd,
        "POST",
        requestBody
      );

      if (data.counts) {
        for (const count of data.counts) {
          const objId = count.catalog_object_id;
          if (objId) {
            // Sum quantities across all locations for the same item
            const currentQty = countsMap[objId] || 0;
            const newQty = Number(count.quantity) || 0;
            countsMap[objId] = currentQty + newQty;
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

// Get merchant info
async function getMerchantInfo(token, isProd) {
  try {
    const data = await rawSquareRequest("/v2/merchants/me", token, isProd);
    return {
      name: data.merchant?.business_name || 'Unknown Business',
      id: data.merchant?.id || '',
      country: data.merchant?.country || ''
    };
  } catch (err) {
    console.error("Could not fetch merchant info:", err.message);
    return { name: 'Unknown Business', id: '', country: '' };
  }
}

/**
 * Sync inventory from Square API and update cache
 * Returns { success: boolean, itemCount: number, error?: string }
 */
export async function syncInventoryFromSquare() {
  const startTime = Date.now();

  try {
    const rawToken = process.env.SQUARE_ACCESS_TOKEN || "";
    const envToken = rawToken.trim().replace(/^["']|["']$/g, '');

    const rawEnv = process.env.SQUARE_ENVIRONMENT || "sandbox";
    const isProduction = rawEnv.toLowerCase().includes("production");

    if (!envToken) {
      throw new Error("Missing SQUARE_ACCESS_TOKEN");
    }

    console.log(`[SYNC] Starting Square inventory sync (Mode: ${isProduction ? 'Production' : 'Sandbox'})...`);

    // Fetch merchant info
    const merchant = await getMerchantInfo(envToken, isProduction);

    // Fetch all catalog objects (items and taxes)
    const allObjects = await fetchAllCatalogObjects(envToken, isProduction);

    const items = allObjects.filter(obj => obj.type === 'ITEM');
    const taxes = allObjects.filter(obj => obj.type === 'TAX');

    console.log(`[SYNC] Found ${items.length} items and ${taxes.length} taxes`);

    // Create tax lookup map
    const taxMap = {};
    for (const tax of taxes) {
      taxMap[tax.id] = {
        name: tax.tax_data?.name || 'Unknown Tax',
        percentage: tax.tax_data?.percentage || '0',
        enabled: tax.tax_data?.enabled !== false
      };
    }

    // Get all variation IDs
    const variationIds = items
      .filter(item => item.item_data?.variations)
      .flatMap(item => item.item_data.variations.map(v => v.id));

    console.log(`[SYNC] Found ${variationIds.length} variations`);

    // Fetch merchant locations
    const locationIds = await getMerchantLocations(envToken, isProduction);

    // Fetch inventory counts
    const inventoryCounts = await getInventoryCounts(variationIds, locationIds, envToken, isProduction);

    // Fetch last sold dates
    const lastSoldMap = await getLastSoldDates(variationIds, envToken, isProduction);

    // Merge all data
    const mergedData = items
      .filter(item => !item.item_data?.is_archived)
      .map(item => {
        if (!item.item_data || !item.item_data.variations) return [];

        const isTaxable = item.item_data.is_taxable === true;
        const itemTaxIds = item.item_data.tax_ids || [];
        const taxInfo = itemTaxIds.map(id => taxMap[id]).filter(Boolean);

        return item.item_data.variations.map(variation => {
          const varData = variation.item_variation_data || {};

          // Get sell price
          let sellPrice = 0;
          if (varData.price_money?.amount) {
            sellPrice = Number(varData.price_money.amount) / 100;
          }

          // Get cost price
          let costPrice = null;
          if (varData.default_unit_cost?.amount) {
            costPrice = Number(varData.default_unit_cost.amount) / 100;
          } else if (varData.item_variation_vendor_infos?.length > 0) {
            const vendorInfo = varData.item_variation_vendor_infos[0];
            if (vendorInfo.item_variation_vendor_info_data?.price_money?.amount) {
              costPrice = Number(vendorInfo.item_variation_vendor_info_data.price_money.amount) / 100;
            }
          }

          const stockCount = inventoryCounts[variation.id] || 0;
          const lastSoldAt = lastSoldMap[variation.id] || null;
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
            isTaxable: isTaxable,
            taxInfo: taxInfo,
            trackInventory: varData.track_inventory || false,
          };
        });
      }).flat();

    // Update cache
    updateInventoryCache(mergedData, merchant);

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`[SYNC] ✓ Synced ${mergedData.length} items in ${duration}s`);

    return {
      success: true,
      itemCount: mergedData.length,
      duration: duration
    };

  } catch (error) {
    console.error("[SYNC] Error:", error);
    return {
      success: false,
      itemCount: 0,
      error: error.message
    };
  }
}
