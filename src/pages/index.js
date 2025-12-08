'use client';

import { useState, useEffect, useMemo } from 'react';

// Format date for display
function formatDate(dateString) {
  if (!dateString) return '—';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-AU', {
    day: 'numeric',
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

export default function ProfitDashboard() {
  const [inventory, setInventory] = useState([]);
  const [merchant, setMerchant] = useState(null);
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

        if (data.merchant) {
          setMerchant(data.merchant);
        }

        if (Array.isArray(data.items)) {
          setInventory(data.items);
        } else if (Array.isArray(data)) {
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

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(item =>
        item.fullName?.toLowerCase().includes(query) ||
        item.name?.toLowerCase().includes(query) ||
        item.sku?.toLowerCase().includes(query)
      );
    }

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
  const SortIndicator = ({ columnKey }) => {
    if (sortConfig.key !== columnKey) {
      return <span className="ml-1 opacity-30">↕</span>;
    }
    return (
      <span className="ml-1 opacity-70">
        {sortConfig.direction === 'asc' ? '↑' : '↓'}
      </span>
    );
  };

  // Loading State
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="spinner mx-auto mb-6"></div>
          <h1 className="app-title text-2xl mb-2">Profit Dashboard</h1>
          <p className="business-name text-sm">Connecting to Square...</p>
        </div>
      </div>
    );
  }

  // Error State
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="apple-card p-10 max-w-md w-full text-center">
          <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-5">
            <svg className="w-7 h-7 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="app-title text-xl mb-3">Unable to Load</h1>
          <p className="text-sm text-gray-500 mb-6">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="apple-button"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Main Content
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="apple-header sticky top-0 z-50">
        <div className="max-w-[1400px] mx-auto px-6 py-5">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
            {/* Title & Business Name */}
            <div className="text-center lg:text-left">
              <h1 className="app-title text-2xl lg:text-3xl text-gray-900">
                Profit Dashboard
              </h1>
              {merchant?.name && (
                <p className="business-name text-sm mt-1">{merchant.name}</p>
              )}
            </div>

            {/* Search */}
            <div className="relative flex-1 max-w-md mx-auto lg:mx-0">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="apple-search"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {/* Stats */}
            <div className="flex justify-center gap-3">
              <div className="stat-pill">
                <span className="text-gray-500">{filteredInventory.length}</span>
                <span>Products</span>
              </div>
              <div className="stat-pill">
                <span className="text-green-600">{filteredInventory.filter(i => costPrices[i.id] ?? i.costPrice).length}</span>
                <span>With Cost</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-[1400px] mx-auto px-6 py-8">
        {filteredInventory.length === 0 ? (
          <div className="apple-card p-16 text-center">
            <svg className="w-12 h-12 text-gray-300 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
            <h2 className="text-lg font-medium text-gray-700 mb-1">No Products Found</h2>
            <p className="text-sm text-gray-500">
              {searchQuery ? 'Try adjusting your search' : 'No items in catalog'}
            </p>
          </div>
        ) : (
          <div className="apple-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="apple-table">
                <thead>
                  <tr>
                    <th
                      className="cursor-pointer hover:text-gray-700 transition-colors"
                      onClick={() => handleSort('name')}
                    >
                      Product <SortIndicator columnKey="name" />
                    </th>
                    <th>SKU</th>
                    <th
                      className="text-right cursor-pointer hover:text-gray-700 transition-colors"
                      onClick={() => handleSort('price')}
                    >
                      Sell <SortIndicator columnKey="price" />
                    </th>
                    <th
                      className="text-right cursor-pointer hover:text-gray-700 transition-colors"
                      onClick={() => handleSort('cost')}
                    >
                      Cost <SortIndicator columnKey="cost" />
                    </th>
                    <th
                      className="text-right cursor-pointer hover:text-gray-700 transition-colors"
                      onClick={() => handleSort('gp')}
                    >
                      GP% <SortIndicator columnKey="gp" />
                    </th>
                    <th className="text-right">Margin</th>
                    <th className="text-center">GST</th>
                    <th
                      className="text-center cursor-pointer hover:text-gray-700 transition-colors"
                      onClick={() => handleSort('lastSold')}
                    >
                      Last Sold <SortIndicator columnKey="lastSold" />
                    </th>
                    <th
                      className="text-right cursor-pointer hover:text-gray-700 transition-colors"
                      onClick={() => handleSort('stock')}
                    >
                      Stock <SortIndicator columnKey="stock" />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInventory.map((item) => {
                    const cost = costPrices[item.id] ?? item.costPrice;
                    const { gpPercent, margin } = calculateProfit(item.price, cost);

                    return (
                      <tr key={item.id}>
                        {/* Product */}
                        <td>
                          <div className="font-medium text-gray-900">{item.name}</div>
                          {item.variationName !== 'Regular' && (
                            <div className="text-xs text-gray-500 mt-0.5">{item.variationName}</div>
                          )}
                        </td>

                        {/* SKU */}
                        <td>
                          <span className="text-xs text-gray-500 font-mono">
                            {item.sku || '—'}
                          </span>
                        </td>

                        {/* Sell Price */}
                        <td className="text-right font-medium">
                          ${item.price?.toFixed(2) || '0.00'}
                        </td>

                        {/* Cost Price */}
                        <td className="text-right">
                          {editingId === item.id ? (
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={tempCost}
                              onChange={(e) => setTempCost(e.target.value)}
                              onBlur={() => handleCostSave(item.id)}
                              onKeyDown={(e) => handleCostKeyDown(e, item.id)}
                              className="w-20 px-2 py-1 text-right text-sm border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                              autoFocus
                            />
                          ) : (
                            <button
                              onClick={() => handleCostEdit(item.id, cost)}
                              className="group inline-flex items-center gap-1 hover:bg-gray-100 px-2 py-1 rounded-lg transition-colors"
                            >
                              {cost ? (
                                <span className={costPrices[item.id] ? 'text-blue-600' : 'text-gray-700'}>
                                  ${cost.toFixed(2)}
                                </span>
                              ) : (
                                <span className="text-gray-400 text-sm">Set</span>
                              )}
                              {costPrices[item.id] && (
                                <span className="text-blue-400 text-xs">*</span>
                              )}
                            </button>
                          )}
                        </td>

                        {/* GP% */}
                        <td className="text-right">
                          {gpPercent !== null ? (
                            <span className={`font-semibold ${
                              gpPercent >= 50 ? 'gp-excellent' :
                              gpPercent >= 30 ? 'gp-good' :
                              gpPercent >= 0 ? 'gp-low' : 'gp-negative'
                            }`}>
                              {gpPercent.toFixed(1)}%
                            </span>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>

                        {/* Margin */}
                        <td className="text-right">
                          {margin !== null ? (
                            <span className={margin >= 0 ? 'text-green-700' : 'text-red-600'}>
                              ${margin.toFixed(2)}
                            </span>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>

                        {/* GST */}
                        <td className="text-center">
                          <span className={`badge ${item.gstEnabled ? 'badge-green' : 'badge-gray'}`}>
                            {item.gstEnabled ? 'GST' : 'No GST'}
                          </span>
                        </td>

                        {/* Last Sold */}
                        <td className="text-center text-sm text-gray-600">
                          {formatDate(item.lastSoldAt)}
                        </td>

                        {/* Stock */}
                        <td className="text-right">
                          <span className={`badge ${
                            item.stockCount > 10 ? 'badge-green' :
                            item.stockCount > 0 ? 'badge-yellow' : 'badge-red'
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

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-xs text-gray-400">
            <span className="text-blue-500">*</span> Manual override · Read-only dashboard · Data from Square
          </p>
        </div>
      </main>
    </div>
  );
}
