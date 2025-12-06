import React, { useState, useEffect, useMemo } from 'react';
import { 
  DollarSign, 
  TrendingUp, 
  Search, 
  AlertCircle, 
  Package, 
  ArrowUpRight
} from 'lucide-react';

// Format currency helper
const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
};

// Calculate days helper
const calculateDaysSince = (dateString) => {
  if (!dateString) return 0;
  const date = new Date(dateString);
  const now = new Date();
  const diffTime = Math.abs(now - date);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
  return diffDays;
};

// Calculate metrics helper
const calculateMetrics = (item) => {
  const profit = item.price_money - item.cost_money;
  const margin = item.price_money > 0 ? (profit / item.price_money) * 100 : 0;
  return { profit, margin };
};

export default function SquareProfitApp() {
  const [inventory, setInventory] = useState([]); 
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');

  // FETCH DATA FROM OUR LOCAL API
  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch('/api/inventory');
        const data = await response.json();
        setInventory(data); 
        setLoading(false);
      } catch (err) {
        console.error("Error loading data", err);
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  // Filter and process logic
  const processedData = useMemo(() => {
    return inventory.map(item => {
      const { profit, margin } = calculateMetrics(item);
      // If last_sold_at is missing, treat it as 0 days or handle as needed
      const daysSinceSold = item.last_sold_at ? calculateDaysSince(item.last_sold_at) : 0;
      
      // Determine status tags
      let status = 'healthy';
      if (margin < 35) status = 'low-margin';
      if (daysSinceSold > 30) status = 'dead-stock';

      return { ...item, profit, margin, daysSinceSold, status };
    }).filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            item.sku?.toLowerCase().includes(searchTerm.toLowerCase());
      
      if (filterType === 'low-margin') return matchesSearch && item.margin < 35;
      if (filterType === 'slow-moving') return matchesSearch && item.daysSinceSold > 14;
      
      return matchesSearch;
    });
  }, [inventory, searchTerm, filterType]);

  // Aggregate Stats
  const totalProfitPotential = processedData.reduce((acc, curr) => acc + (curr.profit * (curr.stock_count || 0)), 0);
  const avgMargin = processedData.length > 0 
    ? processedData.reduce((acc, curr) => acc + curr.margin, 0) / processedData.length 
    : 0;

  if (loading) {
    return <div className="p-10 text-center text-gray-500">Loading Square Inventory...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-lg">
              <TrendingUp className="text-white h-6 w-6" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-gray-900">Square ProfitIQ</h1>
          </div>
          <div className="text-sm text-gray-500 hidden sm:block">
            Connected to: Square
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Top Level Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-500">Current Stock Value (Profit)</span>
              <DollarSign className="h-5 w-5 text-green-600" />
            </div>
            <div className="text-3xl font-bold text-gray-900">{formatCurrency(totalProfitPotential)}</div>
            <div className="text-xs text-green-600 mt-1 flex items-center">
              <ArrowUpRight className="h-3 w-3 mr-1" /> Potential profit in stock
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-500">Avg. Profit Margin</span>
              <div className={`h-5 w-5 rounded-full flex items-center justify-center ${avgMargin > 50 ? 'bg-green-100 text-green-600' : 'bg-yellow-100 text-yellow-600'}`}>
                <span className="text-xs font-bold">%</span>
              </div>
            </div>
            <div className="text-3xl font-bold text-gray-900">{avgMargin.toFixed(1)}%</div>
            <div className="text-xs text-gray-500 mt-1">
              Target: &gt;50%
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-500">Slow Moving Items</span>
              <AlertCircle className="h-5 w-5 text-red-500" />
            </div>
            <div className="text-3xl font-bold text-gray-900">
              {processedData.filter(i => i.daysSinceSold > 30).length}
            </div>
            <div className="text-xs text-red-500 mt-1">
              Not sold in 30+ days
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
            <input 
              type="text" 
              placeholder="Search items or SKU..." 
              className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => setFilterType('all')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filterType === 'all' ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}
            >
              All Items
            </button>
            <button 
              onClick={() => setFilterType('low-margin')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filterType === 'low-margin' ? 'bg-red-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}
            >
              Low Margin
            </button>
            <button 
              onClick={() => setFilterType('slow-moving')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filterType === 'slow-moving' ? 'bg-amber-500 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}
            >
              Slow Moving
            </button>
          </div>
        </div>

        {/* Inventory List */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider">Item</th>
                  <th className="py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Cost vs Sale</th>
                  <th className="py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Profit</th>
                  <th className="py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Margin</th>
                  <th className="py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Last Sold</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {processedData.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="py-8 text-center text-gray-500">
                      No items found matching your filters.
                    </td>
                  </tr>
                ) : (
                  processedData.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50 transition-colors group">
                      <td className="py-4 px-6">
                        <div className="flex items-center">
                          <div className={`h-10 w-10 rounded-md bg-blue-100 flex-shrink-0 flex items-center justify-center mr-3 shadow-inner`}>
                            <Package className="h-5 w-5 text-blue-500 opacity-70" />
                          </div>
                          <div>
                            <div className="font-medium text-gray-900">{item.name}</div>
                            <div className="text-xs text-gray-500">{item.sku} • {item.stock_count || 0} in stock</div>
                          </div>
                        </div>
                      </td>
                      
                      <td className="py-4 px-6 text-right">
                        <div className="text-sm text-gray-900 font-medium">{formatCurrency(item.price_money)}</div>
                        <div className="text-xs text-gray-500">Cost: {formatCurrency(item.cost_money)}</div>
                      </td>

                      <td className="py-4 px-6 text-right">
                        <div className="text-sm font-bold text-green-700">
                          +{formatCurrency(item.profit)}
                        </div>
                      </td>

                      <td className="py-4 px-6 text-right">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          item.margin >= 50 ? 'bg-green-100 text-green-800' : 
                          item.margin >= 30 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {item.margin.toFixed(0)}%
                        </span>
                      </td>

                      <td className="py-4 px-6 text-right">
                        <div className="flex flex-col items-end">
                          <span className={`text-sm font-medium flex items-center gap-1 ${item.daysSinceSold > 30 ? 'text-red-600' : 'text-gray-900'}`}>
                            {item.daysSinceSold === 0 ? 'Today' : `${item.daysSinceSold}d ago`}
                            {item.daysSinceSold > 30 && <AlertCircle className="h-3 w-3" />}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}