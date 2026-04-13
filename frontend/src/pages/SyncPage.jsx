import { useState, useEffect } from 'react';
import { RefreshCw, Database, Clock, CheckCircle2, AlertTriangle, Activity, Server, Smartphone, Loader2, GitMerge, Cloud, CloudOff } from 'lucide-react';
import { useSyncStore } from '../store/syncStore';
import { useNetworkStore } from '../store/networkStore';
import ConflictModal from '../components/sync/ConflictModal';

export default function SyncPage() {
  const { 
    sync, 
    syncStatus, 
    isSyncing, 
    lastSyncTime, 
    vectorClock, 
    localMutations, 
    pendingConflicts,
    resolveConflict
  } = useSyncStore();
  
  const { isOnline } = useNetworkStore();
  const [activeConflict, setActiveConflict] = useState(null);

  const handleResolve = async (resolution) => {
    if (activeConflict) {
      await resolveConflict(activeConflict.id, resolution);
      setActiveConflict(null);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto animate-fade-in">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Sync Center</h1>
          <p className="text-slate-600 mt-1">Distributed CRDT Ledger & Mesh Sync</p>
        </div>
        <button
          onClick={() => sync()}
          disabled={!isOnline || isSyncing}
          className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-bold transition-all shadow-lg ${
            isSyncing 
              ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
              : 'bg-blue-600 text-white hover:bg-blue-700 active:scale-95 shadow-blue-600/20 shadow-lg'
          } ${!isOnline && !isSyncing ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {isSyncing ? <Loader2 className="w-5 h-5 animate-spin" /> : <RefreshCw className="w-5 h-5" />}
          {isSyncing ? 'Syncing...' : 'Sync Now'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-blue-100 rounded-xl text-blue-600">
              <Database className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900">Local Ledger</h3>
          </div>
          <p className="text-3xl font-bold text-slate-900">{localMutations.length}</p>
          <p className="text-sm text-slate-500 mt-1">Pending Mutations</p>
        </div>

        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-purple-100 rounded-xl text-purple-600">
              <Clock className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900">Last Sync</h3>
          </div>
          <p className="text-3xl font-bold text-slate-900">
            {lastSyncTime ? new Date(lastSyncTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Never'}
          </p>
          <p className="text-sm text-slate-500 mt-1">Cloud/Mesh Update</p>
        </div>

        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
          <div className="flex items-center gap-3 mb-4">
            <div className={`p-2 rounded-xl ${syncStatus === 'synced' ? 'bg-green-100 text-green-600' : 'bg-amber-100 text-amber-600'}`}>
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900">Status</h3>
          </div>
          <p className={`text-3xl font-bold capitalize ${syncStatus === 'synced' ? 'text-green-600' : 'text-amber-600'}`}>
            {syncStatus}
          </p>
          <p className="text-sm text-slate-500 mt-1">
            {isOnline ? (
              <span className="flex items-center gap-1"><Cloud className="w-3 h-3" /> Online</span>
            ) : (
              <span className="flex items-center gap-1 text-slate-400"><CloudOff className="w-3 h-3" /> Offline</span>
            )}
          </p>
        </div>
      </div>

      {pendingConflicts.length > 0 && (
        <div className="mb-8 bg-amber-50 border border-amber-200 rounded-3xl p-6 animate-in slide-in-from-top-4 duration-500">
          <div className="flex items-center gap-3 text-amber-800 mb-6">
            <AlertTriangle className="w-6 h-6" />
            <h2 className="text-xl font-bold">Manual Resolution Required</h2>
          </div>
          <div className="grid gap-3">
            {pendingConflicts.map(conflict => (
              <div key={conflict.id} className="bg-white border border-amber-100 rounded-2xl p-4 flex items-center justify-between">
                <div>
                  <p className="font-bold text-slate-900">{conflict.type}: {conflict.recordId}</p>
                  <p className="text-xs text-slate-500 font-mono mt-1">ID: {conflict.id}</p>
                </div>
                <button
                  onClick={() => setActiveConflict(conflict)}
                  className="px-4 py-2 bg-amber-100 text-amber-700 rounded-xl text-sm font-bold hover:bg-amber-200 transition-colors"
                >
                  Resolve Conflict
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-slate-900 rounded-[2rem] p-8 text-white shadow-2xl relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-8">
            <Activity className="w-8 h-8 text-blue-400" />
            <h2 className="text-2xl font-bold">Vector Clock Visualization</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-500/20 rounded-2xl flex items-center justify-center border border-blue-500/30">
                  <Smartphone className="w-6 h-6 text-blue-400" />
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-end mb-2">
                    <span className="text-sm font-bold text-blue-400 uppercase tracking-widest">Local Device</span>
                    <span className="bg-blue-500/20 px-3 py-1 rounded-lg text-xs font-mono text-blue-300 border border-blue-500/10">
                      VC_{Object.values(vectorClock).reduce((a, b) => a + b, 0)}
                    </span>
                  </div>
                  <div className="h-4 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
                    <div 
                      className="h-full bg-blue-500 transition-all duration-1000"
                      style={{ width: `${Math.min(100, localMutations.length * 10)}%` }}
                    ></div>
                  </div>
                </div>
              </div>

              <div className="flex justify-center -my-2 relative h-12">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-0.5 h-full bg-gradient-to-b from-blue-500 to-emerald-500 opacity-20"></div>
                </div>
                <div className={`p-2 rounded-full border-2 transition-all duration-500 z-10 ${
                  isSyncing ? 'bg-white border-blue-500 rotate-180' : 'bg-slate-800 border-slate-700'
                }`}>
                  <RefreshCw className={`w-4 h-4 text-blue-400 ${isSyncing ? 'animate-spin' : ''}`} />
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-emerald-500/20 rounded-2xl flex items-center justify-center border border-emerald-500/30">
                  <Server className="w-6 h-6 text-emerald-400" />
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-end mb-2">
                    <span className="text-sm font-bold text-emerald-400 uppercase tracking-widest">Global Mesh</span>
                    <span className="bg-emerald-500/20 px-3 py-1 rounded-lg text-xs font-mono text-emerald-300 border border-emerald-500/10">
                      VC_Cloud
                    </span>
                  </div>
                  <div className="h-4 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
                    <div 
                      className="h-full bg-emerald-500 transition-all duration-1000"
                      style={{ width: lastSyncTime ? '100%' : '0%' }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-slate-800/50 rounded-3xl p-6 border border-slate-700 backdrop-blur-sm">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <Database className="w-5 h-5 text-blue-400" />
                State Snapshot
              </h3>
              <div className="font-mono text-xs text-blue-100/70 space-y-2 max-h-[200px] overflow-y-auto custom-scrollbar pr-2">
                {Object.entries(vectorClock).length > 0 ? (
                  Object.entries(vectorClock).map(([nodeId, clock]) => (
                    <div key={nodeId} className="flex justify-between p-2 bg-white/5 rounded-xl">
                      <span>{nodeId.substring(0, 12)}...</span>
                      <span className="text-blue-400 font-bold">{clock}</span>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-10 opacity-40">No cluster state found</div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 blur-[100px] -mr-32 -mt-32 rounded-full"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-500/10 blur-[100px] -ml-32 -mb-32 rounded-full"></div>
      </div>

      {activeConflict && (
        <ConflictModal 
          conflict={activeConflict}
          onResolve={handleResolve}
          onClose={() => setActiveConflict(null)}
        />
      )}
    </div>
  );
}

