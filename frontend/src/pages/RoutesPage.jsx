import { useState, useEffect } from 'react';
import { useRouteStore } from '../store/routeStore';
import { Truck, Anchor, Plane, AlertTriangle, RefreshCw, Play, RotateCcw, Map as MapIcon } from 'lucide-react';
import RouteMap from '../components/map/RouteMap';

export default function RoutesPage() {
  const { 
    nodes, 
    edges, 
    failedEdges, 
    computeRoute, 
    activeRoutes, 
    isLoading, 
    triggerFlood, 
    resetNetwork,
    fetchNetworkStatus,
    subscribeToEvents,
    unsubscribeFromEvents
  } = useRouteStore();
  
  const [selectedFrom, setSelectedFrom] = useState('');
  const [selectedTo, setSelectedTo] = useState('');
  const [vehicleType, setVehicleType] = useState('truck');
  const [floodWarning, setFloodWarning] = useState(null);
  const [suggestedVehicle, setSuggestedVehicle] = useState(null);

  useEffect(() => {
    fetchNetworkStatus();
    subscribeToEvents();
    return () => {
      unsubscribeFromEvents();
    };
  }, [fetchNetworkStatus, subscribeToEvents, unsubscribeFromEvents]);

  const vehicleTypes = [
    { id: 'truck', name: 'Truck', icon: Truck, color: 'blue' },
    { id: 'boat', name: 'Boat', icon: Anchor, color: 'cyan' },
    { id: 'drone', name: 'Drone', icon: Plane, color: 'purple' },
  ];

  const handleComputeRoute = async () => {
    if (selectedFrom && selectedTo) {
      const result = await computeRoute(selectedFrom, selectedTo, vehicleType);
      
      if (result.route && result.route.floodWarning) {
        setFloodWarning({
          message: `⚠️ Truck route is flooded! Consider using a boat instead.`,
          floodedEdges: result.route.edges?.filter(e => failedEdges.includes(e.id)).map(e => e.id) || []
        });
        setSuggestedVehicle('boat');
      } else {
        setFloodWarning(null);
        setSuggestedVehicle(null);
      }
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
      blue: isActive ? 'bg-blue-500 text-white border-blue-500 shadow-md' : 'bg-slate-50 text-slate-500 border-slate-200 hover:border-blue-300 hover:bg-blue-50',
      cyan: isActive ? 'bg-cyan-500 text-white border-cyan-500 shadow-md' : 'bg-slate-50 text-slate-500 border-slate-200 hover:border-cyan-300 hover:bg-cyan-50',
      purple: isActive ? 'bg-purple-500 text-white border-purple-500 shadow-md' : 'bg-slate-50 text-slate-500 border-slate-200 hover:border-purple-300 hover:bg-purple-50',
    };
    return colors[color];
  };

  return (
    <div className="p-6 max-w-[1600px] mx-auto animate-fade-in font-sans h-[calc(100vh-100px)] flex flex-col">
      <div className="mb-6 flex justify-between items-end shrink-0">
        <div>
          <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight">Logistics & Routing</h1>
          <p className="text-slate-500 mt-2 text-lg">AI-Optimized paths with real-time disaster topology</p>
        </div>
        <button
          onClick={handleResetNetwork}
          className="flex items-center gap-2 px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-all"
        >
          <RotateCcw className="w-4 h-4" />
          Reset Simulation
        </button>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-0">
        {/* Left Column: Map */}
        <div className="lg:col-span-8 flex flex-col bg-white rounded-[32px] shadow-sm border border-slate-200 overflow-hidden relative">
          <div className="absolute top-4 left-4 z-[400] bg-white/90 backdrop-blur-md p-3 rounded-2xl shadow-lg border border-slate-100 flex items-center gap-3">
             <MapIcon className="w-5 h-5 text-blue-600" />
             <span className="font-extrabold text-slate-900 tracking-tight">Live Topology</span>
             <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse ml-2" />
          </div>
          
          <div className="absolute top-4 right-4 z-[400] flex gap-2">
            <div className="bg-white/90 backdrop-blur-md px-3 py-2 rounded-xl shadow-lg border border-slate-100 flex items-center gap-2">
              <div className="w-4 h-1.5 bg-green-500 rounded" />
              <span className="text-[10px] font-black uppercase text-slate-600 tracking-widest">Clear</span>
            </div>
            <div className="bg-white/90 backdrop-blur-md px-3 py-2 rounded-xl shadow-lg border border-slate-100 flex items-center gap-2">
              <div className="w-4 h-1.5 bg-yellow-500 rounded" />
              <span className="text-[10px] font-black uppercase text-slate-600 tracking-widest">Risk</span>
            </div>
            <div className="bg-white/90 backdrop-blur-md px-3 py-2 rounded-xl shadow-lg border border-slate-100 flex items-center gap-2">
              <div className="w-4 h-1.5 bg-red-500 rounded border-dashed border border-red-600" />
              <span className="text-[10px] font-black uppercase text-slate-600 tracking-widest">Flooded</span>
            </div>
          </div>

          <div className="flex-1 w-full relative z-0">
            <RouteMap />
          </div>
        </div>

        {/* Right Column: Controls */}
        <div className="lg:col-span-4 flex flex-col gap-6 overflow-y-auto pr-2 custom-scrollbar">
          
          {/* Dispatch Center */}
          <div className="bg-white rounded-[32px] p-6 shadow-sm border border-slate-200 shrink-0">
            <h3 className="text-xl font-extrabold text-slate-900 mb-6 flex items-center gap-3">
              <div className="p-2 bg-blue-100 text-blue-600 rounded-xl">
                <Play className="w-5 h-5" />
              </div>
              Dispatch Assignment
            </h3>
            
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Origin</label>
                  <select
                    value={selectedFrom}
                    onChange={(e) => setSelectedFrom(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-inner"
                  >
                    <option value="">Origin Node...</option>
                    {nodes.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Destination</label>
                  <select
                    value={selectedTo}
                    onChange={(e) => setSelectedTo(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-inner"
                  >
                    <option value="">Destination Node...</option>
                    {nodes.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Fleet Category</label>
                <div className="flex gap-2">
                  {vehicleTypes.map(vt => {
                    const Icon = vt.icon;
                    const isActive = vehicleType === vt.id;
                    const isSuggested = suggestedVehicle === vt.id;
                    return (
                      <button
                        key={vt.id}
                        onClick={() => {
                          setVehicleType(vt.id);
                          if (vt.id === 'boat') setSuggestedVehicle(null);
                        }}
                        className={`flex-1 flex flex-col items-center justify-center gap-1.5 py-3 rounded-2xl border-2 transition-all relative ${getVehicleColor(vt.color, isActive)}`}
                      >
                        <Icon className="w-5 h-5" />
                        <span className="text-[10px] font-bold uppercase tracking-wider">{vt.name}</span>
                        {isSuggested && (
                          <span className="absolute -top-2 -right-2 w-5 h-5 bg-amber-400 text-slate-900 rounded-full text-xs font-bold flex items-center justify-center">!</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {floodWarning && (
                <div className="p-4 bg-amber-50 border-2 border-amber-200 rounded-2xl flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-bold text-amber-900 text-sm">{floodWarning.message}</p>
                    {floodWarning.floodedEdges.length > 0 && (
                      <p className="text-[10px] text-amber-700 mt-1">
                        Blocked: {floodWarning.floodedEdges.join(', ')}
                      </p>
                    )}
                    <button
                      onClick={() => {
                        setVehicleType('boat');
                        setSuggestedVehicle(null);
                      }}
                      className="mt-2 px-3 py-1.5 bg-cyan-500 text-white text-xs font-bold rounded-lg hover:bg-cyan-600 transition-all"
                    >
                      🚤 Switch to Boat
                    </button>
                  </div>
                </div>
              )}

              <button
                onClick={handleComputeRoute}
                disabled={!selectedFrom || !selectedTo || isLoading}
                className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-xl active:scale-[0.98]"
              >
                {isLoading ? (
                  <><RefreshCw className="w-5 h-5 animate-spin text-blue-400" /> Computing Path...</>
                ) : (
                  <><Play className="w-5 h-5 text-blue-400 fill-blue-400" /> Dispatch Fleet</>
                )}
              </button>
            </div>
          </div>

          {/* Active Missions */}
          {activeRoutes.length > 0 && (
            <div className="bg-slate-900 rounded-[32px] p-6 shadow-2xl shrink-0 text-white relative overflow-hidden">
              <h3 className="text-xl font-extrabold mb-6 flex items-center gap-3 relative z-10">
                <div className="p-2 bg-blue-500/20 text-blue-400 rounded-xl">
                  <RefreshCw className="w-5 h-5 animate-spin-slow" />
                </div>
                Active Missions ({activeRoutes.length})
              </h3>
              
              <div className="space-y-4 relative z-10">
                {activeRoutes.map((route, index) => {
                  const hasFloodedEdges = route.edges?.some(e => failedEdges.includes(e.id));
                  return (
                    <div key={route.id || index} className={`p-4 rounded-2xl backdrop-blur-md border transition-all ${
                      hasFloodedEdges 
                        ? 'bg-red-500/10 border-red-500/30' 
                        : 'bg-white/5 border-white/10'
                    }`}>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <span className={`p-1.5 flex items-center justify-center rounded-lg ${
                            route.vehicle === 'truck' ? 'bg-blue-500/20 text-blue-400' :
                            route.vehicle === 'boat' ? 'bg-cyan-500/20 text-cyan-400' : 'bg-purple-500/20 text-purple-400'
                          }`}>
                             {route.vehicle === 'truck' ? <Truck className="w-4 h-4"/> : route.vehicle === 'boat' ? <Anchor className="w-4 h-4" /> : <Plane className="w-4 h-4" />}
                          </span>
                          <span className="font-bold text-sm text-slate-200">
                            {route.path?.map(p => p.split('-')[1] || p).join(' → ')}
                          </span>
                          {hasFloodedEdges && (
                            <span className="px-2 py-1 bg-red-500 text-white text-[10px] font-bold rounded-lg ml-auto mr-2">⚠️ FLOODED</span>
                          )}
                        </div>
                        <span className="text-sm font-black text-amber-400">
                          {route.eta_minutes}m ETA
                        </span>
                      </div>
                      
                      <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-white/10">
                        {route.edges?.map(edge => {
                          const isEdgeFlooded = failedEdges.includes(edge.id);
                          return (
                            <span key={edge.id} className={`px-2 py-1 rounded-md text-[10px] font-mono font-bold ${
                              isEdgeFlooded
                                ? 'bg-red-500/30 text-red-200 border border-red-500/50'
                                : 'bg-black/20 text-slate-400 opacity-80'
                            }`}>
                              {edge.id} ({edge.weight}m)
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
              
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/20 blur-[60px] rounded-full pointer-events-none"></div>
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-purple-600/20 blur-[50px] rounded-full pointer-events-none"></div>
            </div>
          )}

          {/* Disaster Simulator */}
          <div className="bg-red-50/50 rounded-[32px] p-6 border-2 border-red-100 flex-1">
            <h3 className="text-xl font-extrabold text-red-900 mb-6 flex items-center gap-3">
              <div className="p-2 bg-red-100 text-red-600 rounded-xl">
                <AlertTriangle className="w-5 h-5" />
              </div>
              Simulate Outage
            </h3>
            
            <div className="space-y-3">
              {edges.slice(0, 10).map(edge => { // Only show top 10 for cleaner UI
                const isFlooded = failedEdges.includes(edge.id);
                return (
                  <div key={edge.id} className="flex items-center justify-between p-1">
                    <div className="flex flex-col">
                      <span className="font-bold text-sm text-slate-700">{edge.id}</span>
                      <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{edge.source} to {edge.target}</span>
                    </div>
                    <button
                      onClick={() => handleTriggerFlood(edge.id)}
                      disabled={isFlooded}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                        isFlooded
                          ? 'bg-red-500 text-white shadow-md shadow-red-500/20 cursor-not-allowed'
                          : 'bg-white text-red-600 border border-red-200 hover:bg-red-100 hover:scale-[1.02]'
                      }`}
                    >
                      {isFlooded ? 'FLOODED' : 'TRIGGER'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
