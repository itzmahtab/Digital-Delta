import { useSyncStore } from '../store/syncStore';
import { useNetworkStore } from '../store/networkStore';
import { RefreshCw, Cloud, CloudOff, AlertTriangle, CheckCircle, Clock, Database, GitMerge } from 'lucide-react';

export default function SyncPage() {
  const { vectorClock, localMutations, pendingConflicts, syncStatus, lastSyncTime, sync, isSyncing } = useSyncStore();
  const { isOnline } = useNetworkStore();

  const getStatusConfig = () => {
    switch (syncStatus) {
      case 'synced':
        return { icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-100', label: 'Synced' };
      case 'conflict':
        return { icon: AlertTriangle, color: 'text-yellow-500', bg: 'bg-yellow-100', label: 'Conflicts Detected' };
      case 'syncing':
        return { icon: RefreshCw, color: 'text-blue-500', bg: 'bg-blue-100', label: 'Syncing...' };
      case 'error':
        return { icon: AlertTriangle, color: 'text-red-500', bg: 'bg-red-100', label: 'Sync Error' };
      default:
        return isOnline 
          ? { icon: Cloud, color: 'text-slate-400', bg: 'bg-slate-100', label: 'Ready to Sync' }
          : { icon: CloudOff, color: 'text-slate-400', bg: 'bg-slate-100', label: 'Offline' };
    }
  };

  const statusConfig = getStatusConfig();
  const StatusIcon = statusConfig.icon;

  return (
    <div className="p-6 max-w-5xl mx-auto animate-fade-in">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">CRDT Sync</h1>
        <p className="text-slate-600 mt-1">Distributed synchronization and conflict resolution</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-900">Connection Status</h3>
            <div className={`p-2 rounded-xl ${statusConfig.bg}`}>
              <StatusIcon className={`w-5 h-5 ${statusConfig.color} ${syncStatus === 'syncing' ? 'animate-spin' : ''}`} />
            </div>
          </div>
          <div className={`px-4 py-3 rounded-xl ${statusConfig.bg} mb-4`}>
            <p className={`font-medium ${statusConfig.color}`}>{statusConfig.label}</p>
          </div>
          <button
            onClick={() => sync()}
            disabled={!isOnline || isSyncing}
            className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-500/25"
          >
            <RefreshCw className={`w-5 h-5 ${isSyncing ? 'animate-spin' : ''}`} />
            Sync Now
          </button>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Database className="w-5 h-5 text-purple-500" />
            Vector Clock
          </h3>
          <div className="font-mono text-sm bg-slate-900 text-green-400 p-4 rounded-xl overflow-x-auto">
            <pre className="whitespace-pre-wrap">
              {JSON.stringify(vectorClock, null, 2)}
            </pre>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mb-6">
        <div className="p-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Pending Mutations</h2>
              <p className="text-sm text-slate-500">{localMutations.length} local change(s) waiting to sync</p>
            </div>
            <GitMerge className="w-5 h-5 text-slate-400" />
          </div>
        </div>
        <div className="divide-y divide-slate-200 max-h-80 overflow-y-auto">
          {localMutations.length === 0 ? (
            <div className="p-12 text-center">
              <div className="p-4 bg-slate-100 rounded-full inline-flex mb-4">
                <Cloud className="w-8 h-8 text-slate-400" />
              </div>
              <p className="text-slate-500">No pending mutations</p>
              <p className="text-sm text-slate-400 mt-1">All changes are synced</p>
            </div>
          ) : (
            localMutations.map((mutation, index) => (
              <div key={mutation.id || index} className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <GitMerge className="w-4 h-4 text-blue-600" />
                    </div>
                    <div>
                      <span className="font-semibold text-slate-900">{mutation.type || 'update'}</span>
                      <p className="text-sm text-slate-500 font-mono truncate max-w-xs">
                        {mutation.record_id || mutation.id}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs text-slate-400">
                    {mutation.timestamp ? new Date(mutation.timestamp).toLocaleTimeString() : 'Unknown'}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {pendingConflicts.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-6">
          <div className="flex items-center gap-3 text-yellow-800 mb-4">
            <div className="p-2 bg-yellow-100 rounded-xl">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-lg">Conflicts Detected</h3>
          </div>
          <div className="space-y-3">
            {pendingConflicts.map((conflict, index) => (
              <div key={conflict.id || index} className="bg-white rounded-xl p-4 border border-yellow-200">
                <p className="font-semibold text-slate-900 mb-3">
                  Record: <span className="font-mono">{conflict.record_id || 'Unknown'}</span>
                </p>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <p className="text-xs text-blue-600 font-medium mb-1">Local Value</p>
                    <p className="font-mono truncate">{conflict.localValue}</p>
                  </div>
                  <div className="p-3 bg-purple-50 rounded-lg">
                    <p className="text-xs text-purple-600 font-medium mb-1">Remote Value</p>
                    <p className="font-mono truncate">{conflict.remoteValue}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {lastSyncTime && (
        <div className="mt-6 flex items-center justify-center gap-2 text-sm text-slate-500">
          <Clock className="w-4 h-4" />
          <span>Last synced: {new Date(lastSyncTime).toLocaleString()}</span>
        </div>
      )}
    </div>
  );
}
