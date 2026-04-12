import { useState, useEffect, useCallback } from 'react';
import { Warehouse, Package, Search, Plus, Minus, RefreshCw, AlertTriangle, TrendingUp, Loader2 } from 'lucide-react';
import api from '../services/api';
import { useSyncStore } from '../store/syncStore';
import { useAuthStore } from '../store/authStore';

export default function InventoryPage() {
  const [inventory, setInventory] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const { addMutation, sync, isSyncing, lastSyncTime } = useSyncStore();
  const { user } = useAuthStore();

  const fetchInventory = useCallback(async () => {
    try {
      const response = await api.get('/api/inventory');
      setInventory(response.data.inventory);
    } catch (err) {
      console.error('Failed to fetch inventory:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInventory();
    
    // Periodic sync every 30s if online
    const interval = setInterval(() => {
      sync();
    }, 30000);
    
    return () => clearInterval(interval);
  }, [fetchInventory, sync]);

  const handleQuantityChange = async (itemId, delta) => {
    const item = inventory.find(i => i.id === itemId);
    const newQty = Math.max(0, item.quantity + delta);
    
    // Optimistic local update
    setInventory(prev => prev.map(i => i.id === itemId ? { ...i, quantity: newQty } : i));
    
    // Record CRDT mutation
    addMutation({
      type: 'INVENTORY_UPDATE',
      recordId: itemId,
      value: { quantity: newQty },
      nodeId: user?.id || 'anonymous'
    });
    
    // Attempt background sync
    sync();
  };

  const filteredInventory = inventory.filter(item =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const lowStockItems = inventory.filter(item => item.quantity < item.min_stock);
  const totalItems = inventory.reduce((acc, item) => acc + item.quantity, 0);

  const getCategoryColor = (category) => {
    const colors = {
      medical: 'bg-red-100 text-red-700',
      water: 'bg-blue-100 text-blue-700',
      food: 'bg-green-100 text-green-700',
      shelter: 'bg-purple-100 text-purple-700',
      fuel: 'bg-yellow-100 text-yellow-700',
    };
    return colors[category] || 'bg-slate-100 text-slate-700';
  };

  return (
    <div className="p-6 max-w-7xl mx-auto animate-fade-in">
      <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Inventory</h1>
          <p className="text-slate-600 mt-1">Supply tracking with CRDT sync status</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-xs text-slate-500">Last Synced</p>
            <p className="text-xs font-medium text-slate-700">
              {lastSyncTime ? new Date(lastSyncTime).toLocaleTimeString() : 'Never'}
            </p>
          </div>
          <button
            onClick={() => sync()}
            disabled={isSyncing}
            className={`p-2 rounded-xl transition-all ${
              isSyncing ? 'bg-blue-50 text-blue-400' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <RefreshCw className={`w-5 h-5 ${isSyncing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="w-10 h-10 text-blue-500 animate-spin mb-4" />
          <p className="text-slate-500 animate-pulse">Loading global inventory ledger...</p>
        </div>
      ) : (
        <>
          {lowStockItems.length > 0 && (
            <div className="bg-gradient-to-r from-red-50 to-orange-50 border border-red-200 rounded-2xl p-5 mb-6">
              <div className="flex items-center gap-3 text-red-800 mb-4">
                <div className="p-2 bg-red-100 rounded-xl">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold">Low Stock Alert</h3>
                  <p className="text-sm text-red-600">{lowStockItems.length} items below minimum threshold</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {lowStockItems.map(item => (
                  <span 
                    key={item.id} 
                    className="px-3 py-1.5 bg-white border border-red-200 text-red-700 rounded-lg text-sm font-medium"
                  >
                    {item.name}: {item.quantity}/{item.min_stock} {item.unit}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-2xl p-5 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-100 text-sm">Total Items</p>
                  <p className="text-3xl font-bold mt-1">{totalItems.toLocaleString()}</p>
                </div>
                <div className="p-3 bg-white/20 rounded-xl">
                  <Package className="w-6 h-6" />
                </div>
              </div>
            </div>
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-500 text-sm">Categories</p>
                  <p className="text-3xl font-bold text-slate-900 mt-1">5</p>
                </div>
                <div className="p-3 bg-purple-100 rounded-xl">
                  <Warehouse className="w-6 h-6 text-purple-600" />
                </div>
              </div>
            </div>
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-500 text-sm">Low Stock Items</p>
                  <p className={`text-3xl font-bold mt-1 ${lowStockItems.length > 0 ? 'text-red-500' : 'text-slate-900'}`}>
                    {lowStockItems.length}
                  </p>
                </div>
                <div className={`p-3 rounded-xl ${lowStockItems.length > 0 ? 'bg-red-100' : 'bg-green-100'}`}>
                  <TrendingUp className={`w-6 h-6 ${lowStockItems.length > 0 ? 'text-red-600' : 'text-green-600'}`} />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-slate-50">
              <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search inventory..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="text-left px-5 py-3 text-sm font-semibold text-slate-700">Item</th>
                    <th className="text-left px-5 py-3 text-sm font-semibold text-slate-700">Category</th>
                    <th className="text-left px-5 py-3 text-sm font-semibold text-slate-700">Quantity</th>
                    <th className="text-left px-5 py-3 text-sm font-semibold text-slate-700">Min Stock</th>
                    <th className="text-left px-5 py-3 text-sm font-semibold text-slate-700 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredInventory.map(item => {
                    const isLowStock = item.quantity < item.min_stock;
                    return (
                      <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-slate-100 rounded-lg">
                              <Package className="w-5 h-5 text-slate-600" />
                            </div>
                            <div>
                              <p className="font-semibold text-slate-900">{item.name}</p>
                              <p className="text-xs text-slate-400 font-mono">{item.id}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <span className={`px-3 py-1 rounded-lg text-sm font-medium capitalize ${getCategoryColor(item.category)}`}>
                            {item.category}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={() => handleQuantityChange(item.id, -1)}
                              className="p-1.5 hover:bg-slate-200 rounded-lg transition-colors"
                            >
                              <Minus className="w-4 h-4 text-slate-500" />
                            </button>
                            <span className={`font-mono font-bold text-lg w-16 text-center ${
                              isLowStock ? 'text-red-600' : 'text-slate-900'
                            }`}>
                              {item.quantity}
                            </span>
                            <button 
                              onClick={() => handleQuantityChange(item.id, 1)}
                              className="p-1.5 hover:bg-slate-200 rounded-lg transition-colors"
                            >
                              <Plus className="w-4 h-4 text-slate-500" />
                            </button>
                            <span className="text-sm text-slate-500">{item.unit}</span>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-slate-500">
                          {item.min_stock} {item.unit}
                        </td>
                        <td className="px-5 py-4 text-right">
                          {isLowStock ? (
                            <span className="px-3 py-1 bg-red-100 text-red-700 rounded-lg text-sm font-medium">
                              Low Stock
                            </span>
                          ) : (
                            <span className="px-3 py-1 bg-green-100 text-green-700 rounded-lg text-sm font-medium">
                              In Stock
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

