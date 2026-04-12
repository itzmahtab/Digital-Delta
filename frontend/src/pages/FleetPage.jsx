import { useState } from 'react';
import { Plane, MapPin, Battery, Navigation, Zap, Radio } from 'lucide-react';

const mockDrones = [
  { id: 'DR001', name: 'Alpha Scout', battery: 85, payload: 5.2, status: 'available', position: { lat: 24.92, lng: 91.87 } },
  { id: 'DR002', name: 'Bravo Responder', battery: 45, status: 'in_flight', position: { lat: 25.02, lng: 91.55 } },
  { id: 'DR003', name: 'Charlie Heavy', battery: 92, payload: 12.0, status: 'charging', position: { lat: 24.88, lng: 91.86 } },
  { id: 'DR004', name: 'Delta Swift', battery: 23, status: 'in_flight', position: { lat: 25.05, lng: 91.60 } },
];

const mockBoats = [
  { id: 'BT001', name: 'River Transport 1', capacity: 500, status: 'en_route', cargo: 'Medical Supplies' },
  { id: 'BT002', name: 'Rescue Boat Alpha', capacity: 300, status: 'at_base', cargo: 'Empty' },
];

export default function FleetPage() {
  const [drones] = useState(mockDrones);
  const [boats] = useState(mockBoats);
  const [selectedDrone, setSelectedDrone] = useState(null);

  const getBatteryConfig = (battery) => {
    if (battery > 60) return { color: 'text-green-500', bg: 'bg-green-100', label: 'Good' };
    if (battery > 30) return { color: 'text-yellow-500', bg: 'bg-yellow-100', label: 'Low' };
    return { color: 'text-red-500', bg: 'bg-red-100', label: 'Critical' };
  };

  const getStatusConfig = (status) => {
    const configs = {
      available: { bg: 'bg-green-100', text: 'text-green-700', label: 'Available' },
      in_flight: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'In Flight' },
      charging: { bg: 'bg-slate-100', text: 'text-slate-700', label: 'Charging' },
      en_route: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'En Route' },
      at_base: { bg: 'bg-slate-100', text: 'text-slate-700', label: 'At Base' },
    };
    return configs[status] || configs.at_base;
  };

  const availableDrones = drones.filter(d => d.status === 'available').length;
  const criticalBatteries = drones.filter(d => d.battery < 30).length;

  return (
    <div className="p-6 max-w-7xl mx-auto animate-fade-in">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Fleet Management</h1>
        <p className="text-slate-600 mt-1">Drone and boat fleet orchestration</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-2xl p-5 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-sm">Available Drones</p>
              <p className="text-3xl font-bold mt-1">{availableDrones}/{drones.length}</p>
            </div>
            <div className="p-3 bg-white/20 rounded-xl">
              <Plane className="w-6 h-6" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-500 text-sm">Critical Batteries</p>
              <p className={`text-3xl font-bold mt-1 ${criticalBatteries > 0 ? 'text-red-500' : 'text-slate-900'}`}>
                {criticalBatteries}
              </p>
            </div>
            <div className="p-3 bg-red-100 rounded-xl">
              <Battery className="w-6 h-6 text-red-500" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-500 text-sm">Active Boats</p>
              <p className="text-3xl font-bold text-slate-900 mt-1">
                {boats.filter(b => b.status === 'en_route').length}
              </p>
            </div>
            <div className="p-3 bg-cyan-100 rounded-xl">
              <Navigation className="w-6 h-6 text-cyan-600" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <Plane className="w-5 h-5 text-blue-500" />
              Drones
            </h2>
            <span className="text-sm text-slate-500">{drones.length} total</span>
          </div>
          <div className="divide-y divide-slate-200">
            {drones.map(drone => {
              const batteryConfig = getBatteryConfig(drone.battery);
              const statusConfig = getStatusConfig(drone.status);
              return (
                <div
                  key={drone.id}
                  onClick={() => setSelectedDrone(drone)}
                  className={`p-4 cursor-pointer hover:bg-slate-50 transition-colors ${
                    selectedDrone?.id === drone.id ? 'bg-blue-50' : ''
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <span className="font-semibold text-slate-900">{drone.name}</span>
                      <span className="ml-2 text-sm text-slate-400 font-mono">{drone.id}</span>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusConfig.bg} ${statusConfig.text}`}>
                      {statusConfig.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <div className={`flex items-center gap-1.5 ${batteryConfig.color}`}>
                      <Battery className="w-4 h-4" />
                      <span className="font-semibold">{drone.battery}%</span>
                      <span className="text-slate-400 text-xs">({batteryConfig.label})</span>
                    </div>
                    {drone.payload && (
                      <span className="text-slate-500 flex items-center gap-1">
                        <Zap className="w-4 h-4" />
                        {drone.payload} kg
                      </span>
                    )}
                  </div>
                  {drone.battery < 30 && (
                    <div className="mt-2 flex items-center gap-1 text-xs text-red-500">
                      <Battery className="w-3 h-3" />
                      <span>Low battery - needs charging</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <Navigation className="w-5 h-5 text-cyan-500" />
              Boats
            </h2>
            <span className="text-sm text-slate-500">{boats.length} total</span>
          </div>
          <div className="divide-y divide-slate-200">
            {boats.map(boat => {
              const statusConfig = getStatusConfig(boat.status);
              return (
                <div key={boat.id} className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <span className="font-semibold text-slate-900">{boat.name}</span>
                      <span className="ml-2 text-sm text-slate-400 font-mono">{boat.id}</span>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusConfig.bg} ${statusConfig.text}`}>
                      {statusConfig.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-slate-600">
                    <span>Capacity: <strong>{boat.capacity} kg</strong></span>
                    <span>Cargo: <strong>{boat.cargo}</strong></span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-2xl border border-purple-200 p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
          <MapPin className="w-5 h-5 text-purple-500" />
          Drone-Only Zones
        </h3>
        <p className="text-sm text-slate-600 mb-4">
          Nodes unreachable by road or water - require drone delivery:
        </p>
        <div className="flex flex-wrap gap-3">
          {['N3 - Sunamganj Camp', 'N5 - Kanaighat Point'].map(node => (
            <div
              key={node}
              className="flex items-center gap-2 px-4 py-3 bg-white rounded-xl border border-purple-200 shadow-sm"
            >
              <Radio className="w-4 h-4 text-purple-500" />
              <span className="font-medium text-purple-700">{node}</span>
              <span className="text-xs text-purple-500">Drone Required</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
