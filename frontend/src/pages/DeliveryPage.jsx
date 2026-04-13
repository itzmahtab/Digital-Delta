import { useState } from 'react';
import { Package, QrCode, CheckCircle, Clock, AlertTriangle, Scan, FileText } from 'lucide-react';
import QRGenerator from '../components/delivery/QRGenerator';
import QRScanner from '../components/delivery/QRScanner';
import PriorityBadge from '../components/delivery/PriorityBadge';

const mockDeliveries = [
  { id: 'D001', cargo: 'Medical Supplies', priority: 'P0', status: 'in_transit', from: 'N1', to: 'N3', eta: '45 min' },
  { id: 'D002', cargo: 'Food Packages', priority: 'P1', status: 'pending', from: 'N1', to: 'N4', eta: '2 hrs' },
  { id: 'D003', cargo: 'Water Containers', priority: 'P2', status: 'pending', from: 'N2', to: 'N3', eta: '4 hrs' },
  { id: 'D004', cargo: 'Blankets', priority: 'P3', status: 'delivered', from: 'N1', to: 'N5', eta: 'Delivered' },
  { id: 'D005', cargo: 'Insulin Kits', priority: 'P0', status: 'in_transit', from: 'N6', to: 'N3', eta: '30 min' },
];

export default function DeliveryPage() {
  const [deliveries] = useState(mockDeliveries);
  const [showQRGenerator, setShowQRGenerator] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [selectedDeliveryId, setSelectedDeliveryId] = useState(null);

  const getStatusIcon = (status) => {
    switch (status) {
      case 'delivered':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'in_transit':
        return <Clock className="w-5 h-5 text-blue-500" />;
      case 'pending':
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      default:
        return <Package className="w-5 h-5 text-slate-400" />;
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'delivered': return 'Delivered';
      case 'in_transit': return 'In Transit';
      case 'pending': return 'Pending';
      default: return status;
    }
  };

  const getStatusBg = (status) => {
    switch (status) {
      case 'delivered': return 'bg-green-50 border-green-200';
      case 'in_transit': return 'bg-blue-50 border-blue-200';
      case 'pending': return 'bg-yellow-50 border-yellow-200';
      default: return 'bg-slate-50 border-slate-200';
    }
  };

  const p0Count = deliveries.filter(d => d.priority === 'P0').length;
  const pendingCount = deliveries.filter(d => d.status !== 'delivered').length;

  return (
    <div className="p-6 max-w-7xl mx-auto animate-fade-in">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Deliveries</h1>
        <p className="text-slate-600 mt-1">Manage deliveries and proof-of-delivery</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-gradient-to-r from-red-500 to-red-600 rounded-2xl p-5 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-red-100 text-sm">Critical (P0)</p>
              <p className="text-3xl font-bold mt-1">{p0Count}</p>
            </div>
            <div className="p-3 bg-white/20 rounded-xl">
              <AlertTriangle className="w-6 h-6" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-500 text-sm">Active Deliveries</p>
              <p className="text-3xl font-bold text-slate-900 mt-1">{pendingCount}</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-xl">
              <Package className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-500 text-sm">Total Deliveries</p>
              <p className="text-3xl font-bold text-slate-900 mt-1">{deliveries.length}</p>
            </div>
            <div className="p-3 bg-green-100 rounded-xl">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 mb-6">
        <button
          onClick={() => setShowQRGenerator(true)}
          className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl hover:opacity-90 shadow-lg shadow-blue-500/25 font-medium transition-all"
        >
          <QrCode className="w-5 h-5" />
          Generate PoD QR
        </button>
        <button
          onClick={() => setShowQRScanner(true)}
          className="flex items-center gap-2 px-5 py-3 bg-white text-slate-700 rounded-xl border border-slate-200 hover:bg-slate-50 font-medium transition-all"
        >
          <Scan className="w-5 h-5" />
          Scan PoD QR
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">All Deliveries</h2>
          <span className="text-sm text-slate-500">{deliveries.length} total</span>
        </div>
        <div className="divide-y divide-slate-200">
          {deliveries.map(delivery => (
            <div key={delivery.id} className="p-5 hover:bg-slate-50 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-xl ${getStatusBg(delivery.status)}`}>
                    {getStatusIcon(delivery.status)}
                  </div>
                  <div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-slate-900">{delivery.id}</span>
                      <PriorityBadge priority={delivery.priority} />
                    </div>
                    <p className="text-slate-600 mt-1">{delivery.cargo}</p>
                    <p className="text-sm text-slate-400 mt-1 flex items-center gap-1">
                      <span className="font-mono">{delivery.from}</span>
                      <span className="mx-1">→</span>
                      <span className="font-mono">{delivery.to}</span>
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                    delivery.status === 'delivered' ? 'bg-green-100 text-green-700' :
                    delivery.status === 'in_transit' ? 'bg-blue-100 text-blue-700' :
                    'bg-yellow-100 text-yellow-700'
                  }`}>
                    {getStatusText(delivery.status)}
                  </div>
                  <p className="text-sm text-slate-500 mt-2">
                    ETA: <span className="font-medium">{delivery.eta}</span>
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {showQRGenerator && (
        <QRGenerator 
          deliveryId={selectedDeliveryId || 'D001'} 
          onClose={() => {
            setShowQRGenerator(false);
            setSelectedDeliveryId(null);
          }} 
        />
      )}
      {showQRScanner && (
        <QRScanner onClose={() => setShowQRScanner(false)} />
      )}
    </div>
  );
}
