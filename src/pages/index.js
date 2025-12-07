'use client';

import { useState, useEffect, useMemo } from 'react';

// Format date for display
function formatDate(dateString) {
  if (!dateString) return '—';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-AU', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

// Calculate GP% and margin
function calculateProfit(sellPrice, costPrice) {
  if (!costPrice || costPrice <= 0 || !sellPrice || sellPrice <= 0) {
    return { gpPercent: null, margin: null };
  }
  const margin = sellPrice - costPrice;
  const gpPercent = (margin / sellPrice) * 100;
  return { gpPercent, margin };
}

export default function InventoryPage() {
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [costPrices, setCostPrices] = useState({});
  const [editingId, setEditingId] = useState(null);
  const [tempCost, setTempCost] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' });

  // Load cost overrides from server
  useEffect(() => {
    async function loadCostOverrides() {
      try {
        const res = await fetch('/api/cost-overrides');
        if (res.ok) {
          const data = await res.json();
          setCostPrices(data);
        }
      } catch (err) {
        console.error('Failed to load cost overrides:', err);
      }
    }
    loadCostOverrides();
  }, []);

  // Fetch inventory data
  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch('/api/inventory');
        if (!res.ok) {
          throw new Error(`Server returned ${res.status} ${res.statusText}`);
        }
        const data = await res.json();
        if (Array.isArray(data)) {
          setInventory(data);
        } else {
          setInventory([]);
          setError("Received invalid data format from server.");
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  // Handle cost price edit
  const handleCostEdit = (id, currentCost) => {
    setEditingId(id);
    setTempCost(currentCost?.toString() || '');
  };

  const handleCostSave = async (id) => {
    const cost = parseFloat(tempCost);
    if (!isNaN(cost) && cost >= 0) {
      // Save to server
      try {
        const res = await fetch('/api/cost-overrides', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, cost })
        });
        if (res.ok) {
          setCostPrices(prev => ({ ...prev, [id]: cost }));
        }
      } catch (err) {
        console.error('Failed to save cost override:', err);
      }
    }
    setEditingId(null);
    setTempCost('');
  };

  const handleCostKeyDown = (e, id) => {
    if (e.key === 'Enter') {
      handleCostSave(id);
    } else if (e.key === 'Escape') {
      setEditingId(null);
      setTempCost('');
    }
  };

  // Sort handler
  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  // Filter and sort inventory
  const filteredInventory = useMemo(() => {
    let filtered = inventory;

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(item =>
        item.fullName?.toLowerCase().includes(query) ||
        item.name?.toLowerCase().includes(query) ||
        item.sku?.toLowerCase().includes(query)
      );
    }

    // Sort
    filtered = [...filtered].sort((a, b) => {
      let aVal, bVal;

      switch (sortConfig.key) {
        case 'name':
          aVal = a.fullName?.toLowerCase() || '';
          bVal = b.fullName?.toLowerCase() || '';
          break;
        case 'price':
          aVal = a.price || 0;
          bVal = b.price || 0;
          break;
        case 'cost':
          aVal = costPrices[a.id] ?? a.costPrice ?? 0;
          bVal = costPrices[b.id] ?? b.costPrice ?? 0;
          break;
        case 'stock':
          aVal = a.stockCount || 0;
          bVal = b.stockCount || 0;
          break;
        case 'gp':
          const aCost = costPrices[a.id] ?? a.costPrice;
          const bCost = costPrices[b.id] ?? b.costPrice;
          const aProfit = calculateProfit(a.price, aCost);
          const bProfit = calculateProfit(b.price, bCost);
          aVal = aProfit.gpPercent ?? -999;
          bVal = bProfit.gpPercent ?? -999;
          break;
        case 'lastSold':
          aVal = a.lastSoldAt ? new Date(a.lastSoldAt).getTime() : 0;
          bVal = b.lastSoldAt ? new Date(b.lastSoldAt).getTime() : 0;
          break;
        default:
          aVal = '';
          bVal = '';
      }

      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [inventory, searchQuery, sortConfig, costPrices]);

  // Sort indicator
  const SortIcon = ({ columnKey }) => {
    if (sortConfig.key !== columnKey) {
      return <span className="text-gray-300 ml-1">↕</span>;
    }
    return (
      <span className="text-blue-500 ml-1">
        {sortConfig.direction === 'asc' ? '↑' : '↓'}
      </span>
    );
  };

  // Loading State
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-100 via-white to-blue-50 flex items-center justify-center">
        <div className="glass-card p-8 text-center">
          <div className="animate-spin w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <h1 className="text-xl font-semibold text-gray-800">Loading Inventory...</h1>
          <p className="text-gray-500 mt-2">Connecting to Square</p>
        </div>
      </div>
    );
  }

  // Error State
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-100 via-white to-red-50 flex items-center justify-center p-4">
        <div className="glass-card p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-gray-800 mb-2">Error Loading Data</h1>
          <p className="text-gray-600 mb-6 font-mono text-sm bg-gray-100 p-3 rounded-lg">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Main Content
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-white to-blue-50">
      {/* Header */}
      <header className="glass-header sticky top-0 z-50">
        <div className="max-w-[1800px] mx-auto px-4 py-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">GP Calculator</h1>
              <p className="text-gray-500 text-sm">Square Inventory Profit Analysis</p>
            </div>

            {/* Search Bar */}
            <div className="relative flex-1 max-w-md">
              <input
                type="text"
                placeholder="Search products by name or SKU..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white/80 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {/* Stats */}
            <div className="flex gap-3">
              <div className="glass-stat">
                <span className="text-gray-500 text-xs uppercase tracking-wider">Products</span>
                <span className="text-lg font-bold text-gray-800">{filteredInventory.length}</span>
              </div>
              <div className="glass-stat">
                <span className="text-gray-500 text-xs uppercase tracking-wider">With Cost</span>
                <span className="text-lg font-bold text-green-600">
                  {filteredInventory.filter(i => costPrices[i.id] ?? i.costPrice).length}
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-[1800px] mx-auto px-4 py-6">
        {filteredInventory.length === 0 ? (
          <div className="glass-card p-12 text-center">
            <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
            <h2 className="text-xl font-semibold text-gray-700">No Products Found</h2>
            <p className="text-gray-500 mt-2">
              {searchQuery ? 'Try adjusting your search terms' : 'No items in your Square catalog'}
            </p>
          </div>
        ) : (
          <div className="glass-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50/80 border-b border-gray-200">
                    <th
                      className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100/50 transition-colors"
                      onClick={() => handleSort('name')}
                    >
                      Product <SortIcon columnKey="name" />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      SKU
                    </th>
                    <th
                      className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100/50 transition-colors"
                      onClick={() => handleSort('price')}
                    >
                      Sell Price <SortIcon columnKey="price" />
                    </th>
                    <th
                      className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100/50 transition-colors"
                      onClick={() => handleSort('cost')}
                    >
                      Cost Price <SortIcon columnKey="cost" />
                    </th>
                    <th
                      className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100/50 transition-colors"
                      onClick={() => handleSort('gp')}
                    >
                      GP% <SortIcon columnKey="gp" />
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Margin $
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      GST
                    </th>
                    <th
                      className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100/50 transition-colors"
                      onClick={() => handleSort('lastSold')}
                    >
                      Last Sold <SortIcon columnKey="lastSold" />
                    </th>
                    <th
                      className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100/50 transition-colors"
                      onClick={() => handleSort('stock')}
                    >
                      Stock <SortIcon columnKey="stock" />
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredInventory.map((item) => {
                    // Use manual override if set, otherwise use Square's cost price
                    const cost = costPrices[item.id] ?? item.costPrice;
                    const { gpPercent, margin } = calculateProfit(item.price, cost);

                    return (
                      <tr key={item.id} className="hover:bg-blue-50/30 transition-colors">
                        {/* Product Name */}
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900">{item.name}</div>
                          {item.variationName !== 'Regular' && (
                            <div className="text-sm text-gray-500">{item.variationName}</div>
                          )}
                        </td>

                        {/* SKU */}
                        <td className="px-4 py-3">
                          <span className="font-mono text-sm text-gray-500">
                            {item.sku || '—'}
                          </span>
                        </td>

                        {/* Sell Price */}
                        <td className="px-4 py-3 text-right">
                          <span className="font-semibold text-gray-900">
                            ${item.price?.toFixed(2) || '0.00'}
                          </span>
                        </td>

                        {/* Cost Price (from Square or editable override) */}
                        <td className="px-4 py-3 text-right">
                          {editingId === item.id ? (
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={tempCost}
                              onChange={(e) => setTempCost(e.target.value)}
                              onBlur={() => handleCostSave(item.id)}
                              onKeyDown={(e) => handleCostKeyDown(e, item.id)}
                              className="w-24 px-2 py-1 text-right border border-blue-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                              autoFocus
                            />
                          ) : (
                            <button
                              onClick={() => handleCostEdit(item.id, cost)}
                              className="group inline-flex items-center gap-1 px-2 py-1 rounded hover:bg-gray-100 transition-colors"
                              title={costPrices[item.id] ? "Manual override (click to edit)" : item.costPrice ? "From Square (click to override)" : "Click to set cost"}
                            >
                              {cost ? (
                                <>
                                  <span className={`font-medium ${costPrices[item.id] ? 'text-blue-600' : 'text-gray-700'}`}>
                                    ${cost.toFixed(2)}
                                  </span>
                                  {costPrices[item.id] && (
                                    <span className="text-xs text-blue-400" title="Manual override">*</span>
                                  )}
                                </>
                              ) : (
                                <span className="text-gray-400 italic">Set cost</span>
                              )}
                              <svg className="w-3 h-3 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                              </svg>
                            </button>
                          )}
                        </td>

                        {/* GP% */}
                        <td className="px-4 py-3 text-right">
                          {gpPercent !== null ? (
                            <span className={`font-bold ${gpPercent >= 50 ? 'text-green-600' : gpPercent >= 30 ? 'text-yellow-600' : gpPercent >= 0 ? 'text-orange-600' : 'text-red-600'}`}>
                              {gpPercent.toFixed(1)}%
                            </span>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>

                        {/* Margin $ */}
                        <td className="px-4 py-3 text-right">
                          {margin !== null ? (
                            <span className={`font-medium ${margin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              ${margin.toFixed(2)}
                            </span>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>

                        {/* GST Status */}
                        <td className="px-4 py-3 text-center">
                          {item.gstEnabled ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                              GST
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                              No GST
                            </span>
                          )}
                        </td>

                        {/* Last Sold */}
                        <td className="px-4 py-3 text-center">
                          <span className="text-sm text-gray-600">
                            {formatDate(item.lastSoldAt)}
                          </span>
                        </td>

                        {/* Stock */}
                        <td className="px-4 py-3 text-right">
                          <span className={`inline-flex items-center justify-center min-w-[3rem] px-2 py-1 rounded-full text-sm font-semibold ${
                            item.stockCount > 10
                              ? 'bg-green-100 text-green-700'
                              : item.stockCount > 0
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-red-100 text-red-700'
                          }`}>
                            {item.stockCount}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Info Footer */}
        <div className="mt-6 text-center text-sm text-gray-500">
          <p>Cost prices are loaded from Square. Click to manually override (saved on server).</p>
          <p className="mt-1 text-xs text-gray-400">
            <span className="text-blue-500">*</span> = manual override | Regular text = from Square | Read-only (never edits Square)
          </p>
        </div>
      </main>
    </div>
  );
}
