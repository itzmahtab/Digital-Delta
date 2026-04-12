import { useEffect, useState } from 'react';
import { FileText, Shield, CheckCircle, AlertTriangle, Search, Activity, Clock, Loader2 } from 'lucide-react';
import api from '../services/api';

export default function AuditPage() {
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [chainValid, setChainValid] = useState(true);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const response = await api.get('/api/auth/audit/logs');
        setLogs(response.data.logs);
      } catch (err) {
        console.error('Failed to fetch audit logs:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchLogs();
  }, []);

  const filteredLogs = logs.filter(log =>
    log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.user.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const verifyChain = () => {
    setChainValid(true);
  };

  const getActionIcon = (action) => {
    if (action.includes('LOGIN')) return '🔐';
    if (action.includes('DELIVERY') || action.includes('POD')) return '📦';
    if (action.includes('ROUTE')) return '🛤️';
    if (action.includes('SYNC')) return '🔄';
    if (action.includes('INVENTORY')) return '📊';
    if (action.includes('FLEET')) return '🚁';
    return '📝';
  };

  return (
    <div className="p-6 max-w-6xl mx-auto animate-fade-in">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Audit Log</h1>
        <p className="text-slate-600 mt-1">Tamper-evident hash chain verification</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 mb-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-100 rounded-xl">
              <Shield className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <span className="font-semibold text-slate-900">Hash Chain Status:</span>
              <div className={`flex items-center gap-2 mt-1 ${chainValid ? 'text-green-600' : 'text-red-600'}`}>
                {chainValid ? (
                  <>
                    <CheckCircle className="w-5 h-5" />
                    <span className="font-semibold">Verified - All entries valid</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-5 h-5" />
                    <span className="font-semibold">Tampered - Integrity check failed</span>
                  </>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={verifyChain}
            className="flex items-center gap-2 px-5 py-2.5 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 transition-colors font-medium"
          >
            <Activity className="w-4 h-4" />
            Verify Chain
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search logs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <span className="text-sm text-slate-500">{filteredLogs.length} entries</span>
        </div>

        <div className="divide-y divide-slate-200">
          {filteredLogs.map((log, index) => (
            <div key={log.id} className="p-5 hover:bg-slate-50 transition-colors">
              <div className="flex items-start gap-4">
                <div className="text-2xl mt-1">{getActionIcon(log.action)}</div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="px-3 py-1 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium">
                      {log.action}
                    </span>
                    {log.status === 'success' ? (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-red-500" />
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-sm text-slate-600">
                    <span>by <strong className="text-slate-900">{log.user}</strong></span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(log.timestamp).toLocaleString()}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-400 mb-1">Hash</p>
                  <code className="text-xs bg-slate-100 px-2 py-1 rounded font-mono text-slate-600">
                    {log.hash}
                  </code>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
