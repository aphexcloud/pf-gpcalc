'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/router';
import { useSession, signOut } from '@/lib/auth-client';

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

// Default GP thresholds
const DEFAULT_THRESHOLDS = {
  excellent: 50,
  good: 30,
  low: 0
};

// All column keys
const ALL_COLUMNS = ['sell', 'cost', 'gp', 'margin', 'gst', 'lastSold', 'stock'];

export default function ProfitDashboard() {
  const router = useRouter();
  const { data: session, isPending } = useSession();

  const [inventory, setInventory] = useState([]);
  const [merchant, setMerchant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [costPrices, setCostPrices] = useState({});
  const [editingId, setEditingId] = useState(null);
  const [tempCost, setTempCost] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' });
  const [lastSync, setLastSync] = useState(null);
  const [syncing, setSyncing] = useState(false);

  // Settings
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [gpThresholds, setGpThresholds] = useState(DEFAULT_THRESHOLDS);

  // Column permissions from user
  const [columnPermissions, setColumnPermissions] = useState(ALL_COLUMNS);

  // Check auth and redirect if not logged in
  useEffect(() => {
    if (!isPending && !session?.user) {
      router.push('/login');
    }
  }, [session, isPending, router]);

  // Load user column permissions
  useEffect(() => {
    if (session?.user) {
      try {
        const perms = session.user.columnPermissions
          ? JSON.parse(session.user.columnPermissions)
          : ALL_COLUMNS;
        setColumnPermissions(perms);
      } catch {
        setColumnPermissions(ALL_COLUMNS);
      }
    }
  }, [session]);

  // Check if user can see a column
  const canSee = (col) => columnPermissions.includes(col);

  // Load settings from server
  useEffect(() => {
    async function loadSettings() {
      try {
        const res = await fetch('/api/settings');
        if (res.ok) {
          const data = await res.json();
          if (data.gpThresholds) {
            setGpThresholds(data.gpThresholds);
          }
        }
      } catch (err) {
        console.error('Failed to load settings:', err);
      }
    }
    loadSettings();
  }, []);

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

        if (data.lastSync) {
          setLastSync(data.lastSync);
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

  // Manual refresh handler (admin only)
  const handleManualRefresh = async () => {
    if (syncing || session?.user?.role !== 'admin') return;

    setSyncing(true);
    setError(null);

    try {
      const res = await fetch('/api/inventory/sync', { method: 'POST' });
      const data = await res.json();

      if (data.success) {
        // Reload inventory
        const invRes = await fetch('/api/inventory');
        const invData = await invRes.json();

        setInventory(invData.items || []);
        setMerchant(invData.merchant);
        setLastSync(invData.lastSync);

        console.log(`Synced ${data.itemCount} items in ${data.duration}s`);
      } else {
        setError(data.error || 'Sync failed');
      }
    } catch (err) {
      setError('Failed to refresh inventory: ' + err.message);
    } finally {
      setSyncing(false);
    }
  };


  // Handle cost price edit
  const handleCostEdit = (id, currentCost) => {
    setEditingId(id);
    setTempCost(currentCost?.toString() || '');
  };

  const handleCostSave = async (id) => {
    const costValue = tempCost.trim();

    // If empty, clear the cost
    if (costValue === '') {
      try {
        const res = await fetch('/api/cost-overrides', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id })
        });
        if (res.ok) {
          setCostPrices(prev => {
            const newPrices = { ...prev };
            delete newPrices[id];
            return newPrices;
          });
        }
      } catch (err) {
        console.error('Failed to clear cost override:', err);
      }
    } else {
      const cost = parseFloat(costValue);
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

  // Clear cost override
  const handleClearCost = async (id) => {
    try {
      const res = await fetch('/api/cost-overrides', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      if (res.ok) {
        setCostPrices(prev => {
          const newPrices = { ...prev };
          delete newPrices[id];
          return newPrices;
        });
      }
    } catch (err) {
      console.error('Failed to clear cost override:', err);
    }
  };

  // Sort handler
  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  // Get GP color class based on thresholds
  const getGpColorClass = (gpPercent) => {
    if (gpPercent >= gpThresholds.excellent) return 'gp-excellent';
    if (gpPercent >= gpThresholds.good) return 'gp-good';
    if (gpPercent >= gpThresholds.low) return 'gp-low';
    return 'gp-negative';
  };

  // Handle logout
  const handleLogout = async () => {
    await signOut();
    router.push('/login');
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

  // Show loading while checking auth
  if (isPending) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="spinner mx-auto mb-6"></div>
          <p className="text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  // Redirect handled by useEffect, show nothing while redirecting
  if (!session?.user) {
    return null;
  }

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
      {/* Settings Sidebar */}
      {settingsOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/20 z-40"
            onClick={() => setSettingsOpen(false)}
          />

          {/* Sidebar */}
          <div className="fixed left-0 top-0 h-full w-80 bg-white shadow-2xl z-50 overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-lg font-semibold text-gray-900">Settings</h2>
                <button
                  onClick={() => setSettingsOpen(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* User Info */}
              <div className="mb-6 pb-6 border-b">
                <p className="text-sm text-gray-500">Signed in as</p>
                <p className="font-medium text-gray-900">{session.user.email}</p>
                {session.user.role === 'admin' && (
                  <span className="inline-block mt-2 text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">
                    Admin
                  </span>
                )}
              </div>

              {/* Navigation */}
              <div className="space-y-2">
                {/* Settings */}
                <button
                  onClick={() => {
                    setSettingsOpen(false);
                    router.push('/settings');
                  }}
                  className="w-full text-left px-4 py-3 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-3 text-gray-700"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span className="font-medium">Settings</span>
                </button>

                {/* Manage Users - Admin Only */}
                {session.user.role === 'admin' && (
                  <button
                    onClick={() => {
                      setSettingsOpen(false);
                      router.push('/admin/users');
                    }}
                    className="w-full text-left px-4 py-3 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-3 text-gray-700"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                    <span className="font-medium">Manage Users</span>
                  </button>
                )}

                {/* Sign Out */}
                <button
                  onClick={handleLogout}
                  className="w-full text-left px-4 py-3 rounded-lg hover:bg-red-50 transition-colors flex items-center gap-3 text-red-600 mt-4"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  <span className="font-medium">Sign Out</span>
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Header */}
      <header className="apple-header sticky top-0 z-30">
        <div className="max-w-[1400px] mx-auto px-6 py-6">
          {/* Menu Button & Centered Title */}
          <div className="relative mb-6">
            {/* Hamburger Menu - Left */}
            <button
              onClick={() => setSettingsOpen(true)}
              className="absolute left-0 top-1/2 -translate-y-1/2 p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Settings"
            >
              <svg className="w-6 h-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            {/* Centered Title & Business Name */}
            <div className="text-center">
              <h1 className="app-title text-3xl lg:text-4xl text-gray-900 mb-2">
                Profit Dashboard
              </h1>
              {merchant?.name && (
                <p className="business-name text-lg lg:text-xl">{merchant.name}</p>
              )}
              {lastSync && (
                <div className="flex items-center justify-center gap-2 mt-2">
                  <p className="text-xs text-gray-500">
                    Last updated: {new Date(lastSync).toLocaleString()}
                  </p>
                  {session?.user?.role === 'admin' && (
                    <button
                      onClick={handleManualRefresh}
                      disabled={syncing}
                      className="text-xs text-blue-600 hover:text-blue-700 underline disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Refresh from Square"
                    >
                      {syncing ? 'Syncing...' : 'Refresh'}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Search & Stats Row */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            {/* Search */}
            <div className="relative w-full max-w-xl">
              <svg
                className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
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
                className="apple-search pl-12"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {/* Stats */}
            <div className="flex gap-3">
              <div className="stat-pill">
                <span className="text-gray-500">{filteredInventory.length}</span>
                <span>Products</span>
              </div>
              {canSee('cost') && (
                <div className="stat-pill">
                  <span className="text-green-600">{filteredInventory.filter(i => costPrices[i.id] ?? i.costPrice).length}</span>
                  <span>With Cost</span>
                </div>
              )}
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
                    {canSee('sell') && (
                      <th
                        className="text-right cursor-pointer hover:text-gray-700 transition-colors"
                        onClick={() => handleSort('price')}
                      >
                        Sell <SortIndicator columnKey="price" />
                      </th>
                    )}
                    {canSee('cost') && (
                      <th
                        className="text-right cursor-pointer hover:text-gray-700 transition-colors"
                        onClick={() => handleSort('cost')}
                      >
                        Cost <SortIndicator columnKey="cost" />
                      </th>
                    )}
                    {canSee('gp') && (
                      <th
                        className="text-right cursor-pointer hover:text-gray-700 transition-colors whitespace-nowrap"
                        onClick={() => handleSort('gp')}
                      >
                        GP% <SortIndicator columnKey="gp" />
                      </th>
                    )}
                    {canSee('margin') && (
                      <th className="text-right">Margin</th>
                    )}
                    {canSee('gst') && (
                      <th className="text-center">GST</th>
                    )}
                    {canSee('lastSold') && (
                      <th
                        className="text-center cursor-pointer hover:text-gray-700 transition-colors whitespace-nowrap"
                        onClick={() => handleSort('lastSold')}
                      >
                        Last Sold <SortIndicator columnKey="lastSold" />
                      </th>
                    )}
                    {canSee('stock') && (
                      <th
                        className="text-right cursor-pointer hover:text-gray-700 transition-colors"
                        onClick={() => handleSort('stock')}
                      >
                        Stock <SortIndicator columnKey="stock" />
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {filteredInventory.map((item) => {
                    const cost = costPrices[item.id] ?? item.costPrice;
                    const { gpPercent, margin } = calculateProfit(item.price, cost);
                    const showGst = item.isTaxable ?? item.gstEnabled ?? false;
                    const hasOverride = costPrices[item.id] !== undefined;

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
                        {canSee('sell') && (
                          <td className="text-right font-medium">
                            ${item.price?.toFixed(2) || '0.00'}
                          </td>
                        )}

                        {/* Cost Price */}
                        {canSee('cost') && (
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
                                placeholder="Clear to remove"
                                className="w-24 px-2 py-1 text-right text-sm border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                autoFocus
                              />
                            ) : (
                              <div className="inline-flex items-center gap-1">
                                <button
                                  onClick={() => handleCostEdit(item.id, cost)}
                                  className="group inline-flex items-center gap-1 hover:bg-gray-100 px-2 py-1 rounded-lg transition-colors"
                                >
                                  {cost ? (
                                    <span className={hasOverride ? 'text-blue-600' : 'text-gray-700'}>
                                      ${cost.toFixed(2)}
                                    </span>
                                  ) : (
                                    <span className="text-gray-400 text-sm">Set</span>
                                  )}
                                  {hasOverride && (
                                    <span className="text-blue-400 text-xs">*</span>
                                  )}
                                </button>
                                {hasOverride && (
                                  <button
                                    onClick={() => handleClearCost(item.id)}
                                    className="text-gray-400 hover:text-red-500 p-1"
                                    title="Clear override"
                                  >
                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                  </button>
                                )}
                              </div>
                            )}
                          </td>
                        )}

                        {/* GP% */}
                        {canSee('gp') && (
                          <td className="text-right">
                            {gpPercent !== null ? (
                              <span className={`font-semibold ${getGpColorClass(gpPercent)}`}>
                                {gpPercent.toFixed(1)}%
                              </span>
                            ) : (
                              <span className="text-gray-300">—</span>
                            )}
                          </td>
                        )}

                        {/* Margin */}
                        {canSee('margin') && (
                          <td className="text-right">
                            {margin !== null ? (
                              <span className="text-gray-700">
                                ${margin.toFixed(2)}
                              </span>
                            ) : (
                              <span className="text-gray-300">—</span>
                            )}
                          </td>
                        )}

                        {/* GST */}
                        {canSee('gst') && (
                          <td className="text-center">
                            <span className={`badge ${showGst ? 'badge-green' : 'badge-gray'}`}>
                              {showGst ? 'GST' : 'No GST'}
                            </span>
                          </td>
                        )}

                        {/* Last Sold */}
                        {canSee('lastSold') && (
                          <td className="text-center text-sm text-gray-600">
                            {formatDate(item.lastSoldAt)}
                          </td>
                        )}

                        {/* Stock */}
                        {canSee('stock') && (
                          <td className="text-right">
                            <span className={`badge ${
                              item.stockCount > 10 ? 'badge-green' :
                              item.stockCount > 0 ? 'badge-yellow' : 'badge-red'
                            }`}>
                              {item.stockCount}
                            </span>
                          </td>
                        )}
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
