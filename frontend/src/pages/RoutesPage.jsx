import { useState } from 'react';
import { useRouteStore } from '../store/routeStore';
import { Truck, Anchor, Plane, AlertTriangle, RefreshCw, Play, RotateCcw } from 'lucide-react';

export default function RoutesPage() {
  const { nodes, edges, failedEdges, computeRoute, activeRoutes, isLoading, triggerFlood, resetNetwork } = useRouteStore();
  const [selectedFrom, setSelectedFrom] = useState('');
  const [selectedTo, setSelectedTo] = useState('');
  const [vehicleType, setVehicleType] = useState('truck');

  const vehicleTypes = [
    { id: 'truck', name: 'Truck', icon: Truck, color: 'blue' },
    { id: 'boat', name: 'Boat', icon: Anchor, color: 'cyan' },
    { id: 'drone', name: 'Drone', icon: Plane, color: 'purple' },
  ];

  const handleComputeRoute = async () => {
    if (selectedFrom && selectedTo) {
      await computeRoute(selectedFrom, selectedTo, vehicleType);
    }
  };

  const handleTriggerFlood = async (edgeId) => {
    await triggerFlood(edgeId);
  };

  const handleResetNetwork = async () => {
    await resetNetwork();
  };

  const getVehicleColor = (color, isActive) => {
    const colors = {
      blue: isActive ? 'bg-blue-500 text-white border-blue-500' : 'bg-blue-50 text-blue-600 border-blue-200 hover:border-blue-300',
      cyan: isActive ? 'bg-cyan-500 text-white border-cyan-500' : 'bg-cyan-50 text-cyan-600 border-cyan-200 hover:border-cyan-300',
      purple: isActive ? 'bg-purple-500 text-white border-purple-500' : 'bg-purple-50 text-purple-600 border-purple-200 hover:border-purple-300',
    };
    return colors[color];
  };

  return (
    <div className="p-6 max-w-7xl mx-auto animate-fade-in">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Route Management</h1>
        <p className="text-slate-600 mt-1">Compute routes and manage network status</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Play className="w-5 h-5 text-blue-500" />
            Compute Route
          </h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Origin</label>
              <select
                value={selectedFrom}
                onChange={(e) => setSelectedFrom(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select origin node</option>
                {nodes.map(n => (
                  <option key={n.id} value={n.id}>{n.id} - {n.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Destination</label>
              <select
                value={selectedTo}
                onChange={(e) => setSelectedTo(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select destination node</option>
                {nodes.map(n => (
                  <option key={n.id} value={n.id}>{n.id} - {n.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Vehicle Type</label>
              <div className="flex gap-2">
                {vehicleTypes.map(vt => {
                  const Icon = vt.icon;
                  const isActive = vehicleType === vt.id;
                  return (
                    <button
                      key={vt.id}
                      onClick={() => setVehicleType(vt.id)}
                      className={`flex-1 flex items-center justify-center gap-2 px-3 py-3 rounded-xl border-2 transition-all ${getVehicleColor(vt.color, isActive)}`}
                    >
                      <Icon className="w-4 h-4" />
                      <span className="text-sm font-medium">{vt.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              onClick={handleComputeRoute}
              disabled={!selectedFrom || !selectedTo || isLoading}
              className="w-full py-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25 transition-all"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  Computing...
                </>
              ) : (
                <>
                  <Play className="w-5 h-5" />
                  Compute Route
                </>
              )}
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              Network Controls
            </h3>
            <button
              onClick={handleResetNetwork}
              className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              <RotateCcw className="w-4 h-4" />
              Reset All
            </button>
          </div>
          
          <p className="text-sm text-slate-600 mb-4">Simulate flood conditions:</p>
          <div className="space-y-2">
            {edges.map(edge => {
              const isFlooded = failedEdges.includes(edge.id);
              return (
                <div
                  key={edge.id}
                  className={`flex items-center justify-between px-4 py-3 rounded-xl transition-all ${
                    isFlooded ? 'bg-red-50 border border-red-200' : 'bg-slate-50'
                  }`}
                >
                  <div>
                    <span className="font-semibold text-slate-900">{edge.id}</span>
                    <span className="text-sm text-slate-500 ml-2">
                      {edge.source} → {edge.target}
                    </span>
                    {isFlooded && (
                      <span className="ml-2 px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs font-medium">
                        FLOODED
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => handleTriggerFlood(edge.id)}
                    disabled={isFlooded}
                    className={`p-2 rounded-lg transition-all ${
                      isFlooded
                        ? 'bg-red-100 text-red-400 cursor-not-allowed'
                        : 'bg-slate-200 text-slate-600 hover:bg-red-100 hover:text-red-600'
                    }`}
                  >
                    <AlertTriangle className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Edge Legend</h3>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-3 bg-green-500 rounded"></div>
              <span className="text-sm text-slate-700">Low Risk (0-30%)</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-3 bg-yellow-500 rounded"></div>
              <span className="text-sm text-slate-700">Medium Risk (30-70%)</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-3 bg-red-500 rounded"></div>
              <span className="text-sm text-slate-700">High Risk (70-100%)</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-3 bg-red-500 rounded border-dashed border-2 border-red-600"></div>
              <span className="text-sm text-slate-700">Flooded Route</span>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-slate-200">
            <h4 className="text-sm font-semibold text-slate-700 mb-3">Vehicle Types</h4>
            <div className="space-y-2 text-sm text-slate-600">
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-blue-500" />
                <span>Truck - Roads only</span>
              </div>
              <div className="flex items-center gap-2">
                <Anchor className="w-4 h-4 text-cyan-500" />
                <span>Boat - Waterways only</span>
              </div>
              <div className="flex items-center gap-2">
                <Plane className="w-4 h-4 text-purple-500" />
                <span>Drone - Airways only</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {activeRoutes.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50">
            <h2 className="text-lg font-semibold text-slate-900">Active Routes</h2>
          </div>
          <div className="divide-y divide-slate-200">
            {activeRoutes.map((route, index) => (
              <div key={route.id || index} className="p-5 hover:bg-slate-50 transition-colors">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-lg text-slate-900">
                      {route.path?.join(' → ')}
                    </span>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold capitalize ${
                      route.vehicle === 'truck' ? 'bg-blue-100 text-blue-700' :
                      route.vehicle === 'boat' ? 'bg-cyan-100 text-cyan-700' :
                      'bg-purple-100 text-purple-700'
                    }`}>
                      {route.vehicle}
                    </span>
                  </div>
                  <span className="text-lg font-semibold text-slate-700">
                    ETA: {route.eta_minutes} min
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {route.edges?.map(edge => (
                    <span
                      key={edge.id}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                        edge.risk > 0.7 ? 'bg-red-100 text-red-700 border border-red-200' :
                        edge.risk > 0.3 ? 'bg-yellow-100 text-yellow-700 border border-yellow-200' :
                        'bg-green-100 text-green-700 border border-green-200'
                      }`}
                    >
                      {edge.id} • {edge.type} • {edge.weight}min
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
