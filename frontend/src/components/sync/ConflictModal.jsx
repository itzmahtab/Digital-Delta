import { X, AlertTriangle, ArrowRight, Check, History } from 'lucide-react';

export default function ConflictModal({ conflict, onResolve, onClose }) {
  if (!conflict) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4 animate-in fade-in duration-300">
      <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-300">
        <div className="p-6 bg-amber-50 border-b border-amber-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-xl">
              <AlertTriangle className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Data Conflict Detected</h2>
              <p className="text-sm text-amber-700 font-medium">Resolution required for: {conflict.recordId}</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-amber-100 rounded-xl transition-colors"
          >
            <X className="w-5 h-5 text-amber-600" />
          </button>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {/* Local Version */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-blue-600 font-semibold text-sm">
                <History className="w-4 h-4" />
                <span>Local Version (Your Device)</span>
              </div>
              <div className="p-5 bg-blue-50 border border-blue-100 rounded-2xl">
                <pre className="text-xs font-mono text-blue-800 whitespace-pre-wrap">
                  {JSON.stringify(conflict.localValue, null, 2)}
                </pre>
                <div className="mt-4 pt-4 border-t border-blue-100 flex items-center justify-between">
                  <span className="text-xs text-blue-500">Updated: Just now</span>
                  <button
                    onClick={() => onResolve('keep_local')}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-all shadow-md shadow-blue-600/20"
                  >
                    Keep Local <Check className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>

            {/* Remote Version */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-purple-600 font-semibold text-sm">
                <Activity className="w-4 h-4" />
                <span>Remote Version (Cloud/Mesh)</span>
              </div>
              <div className="p-5 bg-purple-50 border border-purple-100 rounded-2xl">
                <pre className="text-xs font-mono text-purple-800 whitespace-pre-wrap">
                  {JSON.stringify(conflict.remoteValue, null, 2)}
                </pre>
                <div className="mt-4 pt-4 border-t border-purple-100 flex items-center justify-between">
                  <span className="text-xs text-purple-500">Updated: Earlier</span>
                  <button
                    onClick={() => onResolve('keep_remote')}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-xl text-xs font-bold hover:bg-purple-700 transition-all shadow-md shadow-purple-600/20"
                  >
                    Keep Remote <Check className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 mb-2">
            <h3 className="text-sm font-semibold text-slate-900 mb-2">Vector Clock Analysis</h3>
            <div className="flex items-center gap-2 text-xs text-slate-500 mb-4 font-mono overflow-x-auto pb-2">
              <span className="shrink-0 bg-white px-2 py-1 rounded border">LOCAL: {JSON.stringify(conflict.localClock)}</span>
              <ArrowRight className="w-3 h-3 shrink-0" />
              <span className="shrink-0 bg-white px-2 py-1 rounded border">REMOTE: {JSON.stringify(conflict.remoteClock)}</span>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed italic">
              Note: A conflict occurs when two devices edit the same record without knowing about each other's changes.
              Choosing a version will broadcast a new mutation with a higher vector clock to all peers.
            </p>
          </div>
        </div>

        <div className="p-6 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 text-slate-600 font-semibold hover:text-slate-900 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
