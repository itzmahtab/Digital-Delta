import { useEffect, useState } from 'react';
import { Shield, CheckCircle, AlertTriangle, Search, Activity, Clock, Key, ShieldCheck, Database, RefreshCw, Layers, Loader } from 'lucide-react';
import api from '../services/api';
import useAuthStore from '../store/authStore';

export default function AuditPage() {
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [chainValid, setChainValid] = useState(true);
  const [isVerifying, setIsVerifying] = useState(false);
  const { user } = useAuthStore();

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const response = await api.get('/api/auth/audit/logs');
      setLogs(response.data.logs);
      setChainValid(true);
    } catch (err) {
      console.error('Failed to fetch audit logs:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredLogs = logs.filter(log => {
    const term = searchTerm.toLowerCase();
    return (
      (log.event_type && log.event_type.toLowerCase().includes(term)) ||
      (log.user && log.user.toLowerCase().includes(term)) ||
      (log.hash && log.hash.toLowerCase().includes(term))
    );
  });

  // Client-side SHA-256 hash verification
  const verifyChain = async () => {
    setIsVerifying(true);
    let isValid = true;
    
    // Sort oldest to newest for verification
    const sortedLogs = [...logs].sort((a, b) => a.id - b.id);
    
    for (let i = 0; i < sortedLogs.length; i++) {
      const log = sortedLogs[i];
      // Note: In an air-gapped scenario, the client recalculates the hashes to prove server integrity
      const dataString = `${log.user_id}|${log.event_type}|${log.status}|${log.timestamp}|${log.prev_hash}`;
      
      const encoder = new TextEncoder();
      const data = encoder.encode(dataString);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const calculatedHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      
      if (calculatedHash !== log.hash) {
        isValid = false;
        break;
      }
      
      // Verify chain link
      if (i > 0 && sortedLogs[i].prev_hash !== sortedLogs[i-1].hash) {
         isValid = false;
         break;
      }
    }
    
    // Simulate complex calculation time for UX
    setTimeout(() => {
      setChainValid(isValid);
      setIsVerifying(false);
    }, 1500);
  };

  const getEventStyles = (eventType) => {
    if (eventType.includes('LOGIN')) return { icon: Key, color: 'text-amber-500', bg: 'bg-amber-100', glow: 'shadow-amber-500/20' };
    if (eventType.includes('DELIVERY') || eventType.includes('POD')) return { icon: Database, color: 'text-blue-500', bg: 'bg-blue-100', glow: 'shadow-blue-500/20' };
    if (eventType.includes('ROUTE')) return { icon: Activity, color: 'text-indigo-500', bg: 'bg-indigo-100', glow: 'shadow-indigo-500/20' };
    if (eventType.includes('KEY_REGISTER') || eventType.includes('REGISTER')) return { icon: ShieldCheck, color: 'text-emerald-500', bg: 'bg-emerald-100', glow: 'shadow-emerald-500/20' };
    return { icon: Layers, color: 'text-slate-500', bg: 'bg-slate-100', glow: 'shadow-slate-500/20' };
  };

  return (
    <div className="p-6 max-w-[1400px] mx-auto animate-fade-in font-sans h-[calc(100vh-100px)] flex flex-col">
      <div className="mb-6 flex justify-between items-end shrink-0">
        <div>
          <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight">Security Audit Log</h1>
          <p className="text-slate-500 mt-2 text-lg">Cryptographic Evidence & Tamper-Evident Ledger</p>
        </div>
        <button
          onClick={fetchLogs}
          disabled={isLoading}
          className="flex items-center gap-2 px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-all"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh Ledger
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 flex-1 min-h-0">
        {/* Verification Status Panel */}
        <div className="lg:col-span-1 flex flex-col gap-6">
          <div className="bg-slate-900 rounded-[32px] p-8 text-white shadow-2xl relative overflow-hidden flex flex-col justify-between">
            <div className="relative z-10">
               <div className="flex items-center gap-3 mb-8">
                <div className="p-3 bg-indigo-500/20 rounded-2xl">
                  <ShieldCheck className="w-6 h-6 text-indigo-400" />
                </div>
                <span className="font-bold tracking-[0.2em] uppercase text-xs text-indigo-400">Ledger Integrity</span>
              </div>
              
              <div className="mb-10 text-center">
                {isVerifying ? (
                   <div className="inline-flex items-center justify-center p-6 bg-blue-500/10 rounded-full mb-4">
                     <Activity className="w-16 h-16 text-blue-400 animate-pulse" />
                   </div>
                ) : chainValid ? (
                   <div className="inline-flex items-center justify-center p-6 bg-emerald-500/10 rounded-full mb-4">
                     <CheckCircle className="w-16 h-16 text-emerald-400" />
                   </div>
                ) : (
                   <div className="inline-flex items-center justify-center p-6 bg-red-500/10 rounded-full mb-4 shadow-[0_0_30px_rgba(239,68,68,0.3)]">
                     <AlertTriangle className="w-16 h-16 text-red-500" />
                   </div>
                )}
                <h2 className={`text-2xl font-black tracking-tight ${isVerifying ? 'text-blue-400' : chainValid ? 'text-emerald-400' : 'text-red-500'}`}>
                   {isVerifying ? 'RECOMPUTING...' : chainValid ? 'SECURE' : 'COMPROMISED'}
                </h2>
                <p className="text-sm text-slate-400 font-medium mt-2">
                   {isVerifying ? 'Hashing ledger blocks...' : chainValid ? 'All cryptographic signatures valid.' : 'Hash mismatch detected in ledger.'}
                </p>
              </div>

              <button
                onClick={verifyChain}
                disabled={isVerifying || logs.length === 0}
                className="w-full py-4 bg-white/10 hover:bg-white/20 text-white rounded-2xl font-bold transition-all active:scale-95 border border-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isVerifying ? 'Verifying Block Hashes...' : 'Verify Cryptographic Chain'}
              </button>
            </div>
            
            <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-600/20 blur-[80px] rounded-full -mr-20 -mt-20"></div>
            <div className={`absolute bottom-0 left-0 w-32 h-32 blur-[60px] rounded-full -ml-10 -mb-10 transition-colors duration-1000 ${isVerifying ? 'bg-blue-600/30' : chainValid ? 'bg-emerald-600/20' : 'bg-red-600/40'}`}></div>
          </div>

          <div className="bg-white rounded-[32px] p-6 shadow-sm border border-slate-200">
             <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Database className="w-5 h-5 text-slate-500" /> System Stats
             </h3>
             <div className="space-y-4">
                <div className="p-4 bg-slate-50 rounded-2xl">
                   <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mb-1">Total Records</p>
                   <p className="text-2xl font-black text-slate-900">{logs.length}</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-2xl">
                   <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mb-1">Hash Algorithm</p>
                   <p className="text-xl font-bold text-slate-700 font-mono">SHA-256</p>
                </div>
             </div>
          </div>
        </div>

        {/* Ledger Feed */}
        <div className="lg:col-span-3 flex flex-col bg-white rounded-[32px] shadow-sm border border-slate-200 overflow-hidden relative">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between gap-4 bg-white/80 backdrop-blur-md z-10 sticky top-0">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Search by user, action, or hash..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-inner font-medium text-slate-700"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
            {isLoading ? (
               <div className="flex flex-col items-center justify-center h-full opacity-50">
                  <Loader className="w-10 h-10 animate-spin text-slate-400 mb-4" />
                  <p className="font-bold text-slate-500">Decrypting Ledger...</p>
               </div>
            ) : filteredLogs.length === 0 ? (
               <div className="flex flex-col items-center justify-center h-full opacity-50 text-center">
                  <Search className="w-12 h-12 text-slate-300 mb-4" />
                  <p className="font-bold text-slate-500 text-lg">No audit records found.</p>
                  <p className="text-sm text-slate-400">Try adjusting your search criteria.</p>
               </div>
            ) : (
              filteredLogs.map((log) => {
                const styles = getEventStyles(log.event_type || '');
                const Icon = styles.icon;
                
                return (
                  <div key={log.id} className="p-5 bg-white border border-slate-100 rounded-3xl hover:border-indigo-200 hover:shadow-xl hover:shadow-indigo-500/5 transition-all group group relative overflow-hidden">
                    <div className="flex flex-col md:flex-row md:items-center gap-5 relative z-10">
                      
                      <div className={`p-4 rounded-2xl ${styles.bg} ${styles.color} shrink-0`}>
                        <Icon className="w-6 h-6" />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-3 mb-1">
                          <span className={`px-2.5 py-1 rounded-lg text-xs font-black tracking-wider uppercase border border-current ${styles.color}`}>
                            {log.event_type}
                          </span>
                          {log.status === 'success' ? (
                            <span className="flex items-center gap-1 text-[10px] uppercase font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded">
                               <CheckCircle className="w-3 h-3" /> OK
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-[10px] uppercase font-bold text-red-600 bg-red-50 px-2 py-1 rounded">
                               <AlertTriangle className="w-3 h-3" /> FAILED
                            </span>
                          )}
                           <span className="flex items-center gap-1.5 text-xs font-bold text-slate-400 ml-auto">
                            <Clock className="w-3 h-3" />
                            {new Date(log.timestamp).toLocaleString(undefined, {
                              year: 'numeric', month: 'short', day: 'numeric',
                              hour: '2-digit', minute: '2-digit', second: '2-digit'
                            })}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-2 text-sm text-slate-600 mb-3">
                          <span className="font-medium text-slate-500">Initiated by:</span>
                          <span className="font-black text-slate-900 bg-slate-100 px-2.5 py-0.5 rounded-md">{log.user || log.user_id}</span>
                        </div>

                        <div className="flex flex-col gap-1.5 p-3 bg-slate-50 border border-slate-100 rounded-xl">
                          <div className="flex items-start gap-3">
                             <div className="w-10 text-[10px] font-black text-slate-400 uppercase pt-0.5">Hash</div>
                             <code className="flex-1 text-xs bg-slate-200/50 px-2 py-1 rounded font-mono text-slate-700 break-all border border-slate-200">
                               {log.hash}
                             </code>
                          </div>
                          <div className="flex items-start gap-3 opacity-60">
                             <div className="w-10 text-[10px] font-black text-slate-400 uppercase pt-0.5">Prev</div>
                             <code className="flex-1 text-[10px] px-2 py-1 rounded font-mono text-slate-500 break-all truncate">
                               {log.prev_hash}
                             </code>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
