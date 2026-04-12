import { useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { useRouteStore } from '../store/routeStore';
import { useNetworkStore } from '../store/networkStore';
import { MapPin, Truck, Droplets, Wifi, AlertTriangle, Activity, Shield, Clock, CheckCircle } from 'lucide-react';
import RouteMap from '../components/map/RouteMap';
import { generateKeyPair, storeKeys } from '../services/crypto';

export default function DashboardPage() {
  const { user, registerDeviceKey } = useAuthStore();
  const { nodes, edges, failedEdges, fetchNetworkStatus, subscribeToEvents, unsubscribeFromEvents, isLoading } = useRouteStore();
  const { isOnline } = useNetworkStore();
  const [keyStatus, setKeyStatus] = useState(null);

  useEffect(() => {
    fetchNetworkStatus();
    subscribeToEvents();
    return () => unsubscribeFromEvents();
  }, [fetchNetworkStatus, subscribeToEvents, unsubscribeFromEvents]);

  useEffect(() => {
    const syncKeys = async () => {
      if (!user) return;
      
      const storedPubK = localStorage.getItem(`dd_pubk_${user.username}`);
      if (!storedPubK || !user.publicKey) {
        setKeyStatus('generating');
        try {
          const keys = await generateKeyPair();
          await storeKeys(user.username, keys);
          await registerDeviceKey(JSON.stringify(keys.publicKey));
          setKeyStatus('registered');
          setTimeout(() => setKeyStatus(null), 5000);
        } catch (e) {
          console.error('Key sync failed:', e);
          setKeyStatus('error');
        }
      }
    };
    
    syncKeys();
  }, [user, registerDeviceKey]);

  const floodedCount = failedEdges.length;
  const activeEdges = edges.filter(e => !e.is_flooded).length;

  const stats = [
    { label: 'Active Nodes', value: nodes.length, icon: MapPin, color: 'from-blue-500 to-blue-600', bgColor: 'bg-blue-100' },
    { label: 'Active Routes', value: activeEdges, icon: Truck, color: 'from-green-500 to-green-600', bgColor: 'bg-green-100' },
    { label: 'Flooded Routes', value: floodedCount, icon: Droplets, color: floodedCount > 0 ? 'from-red-500 to-red-600' : 'from-slate-400 to-slate-500', bgColor: floodedCount > 0 ? 'bg-red-100' : 'bg-slate-100' },
    { label: 'Network Status', value: isOnline ? 'Online' : 'Offline', icon: Wifi, color: isOnline ? 'from-green-500 to-emerald-500' : 'from-slate-400 to-slate-500', bgColor: isOnline ? 'bg-green-100' : 'bg-slate-100' },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto animate-fade-in">
      <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-slate-600 mt-1">Real-time network status and route overview</p>
        </div>
        
        {keyStatus && (
          <div className={`flex items-center gap-3 px-4 py-2 rounded-xl border animate-in slide-in-from-right-4 duration-500 ${
            keyStatus === 'generating' ? 'bg-blue-50 border-blue-200 text-blue-700' :
            keyStatus === 'registered' ? 'bg-green-50 border-green-200 text-green-700' :
            'bg-red-50 border-red-200 text-red-700'
          }`}>
            {keyStatus === 'generating' && <Clock className="w-4 h-4 animate-spin" />}
            {keyStatus === 'registered' && <CheckCircle className="w-4 h-4" />}
            {keyStatus === 'error' && <AlertTriangle className="w-4 h-4" />}
            <span className="text-sm font-medium">
              {keyStatus === 'generating' && 'Generating Device Keys...'}
              {keyStatus === 'registered' && 'Device Key Registered Successfully'}
              {keyStatus === 'error' && 'Key Registration Failed'}
            </span>
            {keyStatus === 'registered' && <Shield className="w-4 h-4 opacity-50" />}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div 
              key={stat.label} 
              className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 hover:shadow-md transition-shadow"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-xl ${stat.bgColor}`}>
                  <Icon className={`w-6 h-6 bg-gradient-to-br ${stat.color} text-white p-1 rounded-lg`} />
                </div>
                <div>
                  <p className="text-sm text-slate-500">{stat.label}</p>
                  <p className={`text-2xl font-bold ${stat.label === 'Flooded Routes' && floodedCount > 0 ? 'text-red-600' : 'text-slate-900'}`}>
                    {stat.value}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mb-6">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Network Map</h2>
            <p className="text-sm text-slate-500">Sylhet Division - Real-time status</p>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Activity className="w-4 h-4" />
            <span>Live</span>
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          </div>
        </div>
        <div className="h-[500px]">
          <RouteMap />
        </div>
      </div>

      {floodedCount > 0 && (
        <div className="bg-gradient-to-r from-red-50 to-orange-50 border border-red-200 rounded-2xl p-5 animate-fade-in">
          <div className="flex items-center gap-3 text-red-800">
            <div className="p-2 bg-red-100 rounded-xl">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold">Flood Warning Active</h3>
              <p className="text-sm text-red-600 mt-0.5">
                {floodedCount} route{floodedCount > 1 ? 's are' : ' is'} currently flooded. 
                Routes have been automatically rerouted.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
          <h3 className="font-semibold text-slate-900 mb-3">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-2">
            <a href="/routes" className="flex items-center gap-2 px-4 py-3 bg-slate-50 hover:bg-slate-100 rounded-xl text-sm font-medium text-slate-700 transition-colors">
              <Truck className="w-4 h-4" />
              Manage Routes
            </a>
            <a href="/deliveries" className="flex items-center gap-2 px-4 py-3 bg-slate-50 hover:bg-slate-100 rounded-xl text-sm font-medium text-slate-700 transition-colors">
              <Droplets className="w-4 h-4" />
              View Deliveries
            </a>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
          <h3 className="font-semibold text-slate-900 mb-3">Legend</h3>
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="w-8 h-1 bg-green-500 rounded"></div>
              <span className="text-sm text-slate-600">Low Risk</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-1 bg-yellow-500 rounded"></div>
              <span className="text-sm text-slate-600">Medium Risk</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-1 bg-red-500 rounded"></div>
              <span className="text-sm text-slate-600">High Risk / Flooded</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
