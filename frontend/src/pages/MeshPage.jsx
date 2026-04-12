import { useState, useEffect } from 'react';
import { Wifi, Zap, Share2, Send, Database, Clock, Activity, Cpu, ShieldCheck } from 'lucide-react';
import useMeshStore from '../store/meshStore';

export default function MeshPage() {
  const { 
    nodeId, 
    role, 
    isOnline,
    setOnline,
    neighbors, 
    queue, 
    relayLogs, 
    setRole, 
    sendBeacon, 
    enqueueMessage, 
    cleanNeighbors 
  } = useMeshStore();

  const [testMessage, setTestMessage] = useState('');

  // Mesh Heartbeat
  useEffect(() => {
    sendBeacon();
    const interval = setInterval(() => {
      sendBeacon();
      cleanNeighbors();
    }, 5000);
    return () => clearInterval(interval);
  }, [sendBeacon, cleanNeighbors]);

  const handleSendTest = () => {
    if (!testMessage.trim()) return;
    enqueueMessage({
      id: `msg-${Date.now()}`,
      type: 'TEXT',
      content: testMessage,
      sender: nodeId,
      hops: []
    });
    setTestMessage('');
  };

  const activeNeighbors = Object.values(neighbors);

  return (
    <div className="p-6 max-w-7xl mx-auto animate-fade-in font-sans">
      <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight">Mesh Operations</h1>
          <p className="text-slate-500 mt-2 text-lg">Resilient store-and-forward edge protocol Management</p>
        </div>
        
        <div className="flex flex-col gap-3">
           <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200 shadow-inner">
            <button
              onClick={() => setRole('client')}
              className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${
                role === 'client' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Endpoint Node
            </button>
            <button
              onClick={() => setRole('relay')}
              className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${
                role === 'relay' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Relay Gateway
            </button>
          </div>

          <button
            onClick={() => setOnline(!isOnline)}
            className={`flex items-center justify-between px-6 py-3 rounded-2xl font-bold transition-all shadow-lg hover:scale-[1.02] active:scale-[0.98] ${
              isOnline 
                ? 'bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-emerald-200' 
                : 'bg-gradient-to-r from-red-500 to-orange-600 text-white shadow-red-200'
            }`}
          >
            <div className="flex items-center gap-3">
              <Zap className={`w-5 h-5 ${isOnline ? 'animate-pulse' : ''}`} />
              <span>{isOnline ? 'Network Uplink: ACTIVE' : 'Network Uplink: OFFLINE'}</span>
            </div>
            <div className={`w-3 h-3 rounded-full bg-white ml-4 ${isOnline ? 'animate-ping' : ''}`} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
        {/* Node Performance */}
        <div className="bg-slate-900 rounded-[32px] p-8 text-white shadow-2xl relative overflow-hidden flex flex-col justify-between">
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-8">
              <div className="p-3 bg-blue-500/20 rounded-2xl">
                <Cpu className="w-6 h-6 text-blue-400" />
              </div>
              <span className="font-bold tracking-[0.2em] uppercase text-xs text-blue-400">Node Core</span>
            </div>
            <p className="text-5xl font-black mb-2 font-mono tracking-tighter">
              {nodeId.split('-')[1].toUpperCase()}
            </p>
            <p className="text-sm text-slate-400 font-medium mb-12">Hardware ID: {nodeId}</p>
          </div>

          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-2">
               <div className={`w-3 h-3 rounded-full ${role === 'relay' ? 'bg-emerald-500' : 'bg-blue-500'} shadow-[0_0_12px] ${role === 'relay' ? 'shadow-emerald-500/50' : 'shadow-blue-500/50'}`} />
               <span className="text-sm font-bold opacity-90 uppercase tracking-[0.1em]">{role} Mode Active</span>
            </div>
            <p className="text-xs text-slate-500">Auto-relay enabled: {role === 'relay' ? 'YES' : 'DEMAND'}</p>
          </div>
          
          <div className="absolute top-0 right-0 w-48 h-48 bg-blue-600/20 blur-[80px] rounded-full -mr-20 -mt-20"></div>
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-purple-600/20 blur-[60px] rounded-full -ml-10 -mb-10"></div>
        </div>

        {/* Neighbors Visualization */}
        <div className="bg-white rounded-[32px] p-8 shadow-sm border border-slate-200 lg:col-span-3">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-indigo-100 rounded-2xl text-indigo-600 shadow-inner">
                <Wifi className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-extrabold text-slate-900">Peer Topology ({activeNeighbors.length})</h3>
                <p className="text-slate-400 text-xs font-semibold uppercase tracking-widest mt-0.5">Real-time neighbor discovery</p>
              </div>
            </div>
            {isOnline && (
               <span className="flex items-center gap-2 text-xs font-bold text-emerald-600 bg-emerald-50 px-4 py-2 rounded-xl border border-emerald-100">
                 <Activity className="w-3 h-3 animate-pulse" />
                 UP-LINK ESTABLISHED
               </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeNeighbors.length === 0 ? (
              <div className="col-span-full py-16 text-center border-2 border-dashed border-slate-100 rounded-[28px] bg-slate-50/50">
                <Wifi className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                <p className="text-slate-400 font-medium">Scanning for peer-to-peer signals...</p>
                <p className="text-slate-300 text-xs mt-1 italic">Open another tab to simulate nearby nodes</p>
              </div>
            ) : (
              activeNeighbors.map(neighbor => (
                <div key={neighbor.nodeId} className="group flex flex-col p-5 bg-white rounded-2xl border border-slate-100 hover:border-blue-500 hover:shadow-xl hover:shadow-blue-500/10 transition-all duration-300">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 rounded-2xl bg-slate-900 flex items-center justify-center font-black text-white text-lg shadow-lg">
                      {neighbor.nodeId.substring(5, 7).toUpperCase()}
                    </div>
                    <div className="flex flex-col items-end">
                       <div className="flex gap-0.5 mb-1">
                          {[1,2,3,4].map(i => <div key={i} className={`w-1 h-3 rounded-full ${i <= 3 ? 'bg-emerald-500' : 'bg-slate-200'}`} />)}
                       </div>
                       <span className="text-[10px] font-bold text-slate-400">92% Signal</span>
                    </div>
                  </div>
                  <p className="text-sm font-black text-slate-900 truncate mb-1">{neighbor.nodeId}</p>
                  <div className="flex items-center justify-between mt-auto">
                    <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md ${neighbor.role === 'relay' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
                      {neighbor.role}
                    </span>
                    <span className="text-[10px] font-bold text-slate-400 italic">~12ms Ping</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 h-full">
        {/* Message Creation */}
        <div className="xl:col-span-1 bg-white rounded-[40px] p-8 shadow-sm border border-slate-200 flex flex-col min-h-[400px]">
          <div className="flex items-center gap-4 mb-8">
            <div className="p-3 bg-blue-100 rounded-2xl text-blue-600">
              <Send className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">Data Transmission</h3>
          </div>
          
          <div className="flex-1 flex flex-col gap-6">
            <div className="relative flex-1">
              <textarea
                value={testMessage}
                onChange={(e) => setTestMessage(e.target.value)}
                placeholder="Type a message or command to push into the mesh lattice..."
                className="w-full h-full p-6 bg-slate-50 border border-slate-100 rounded-3xl focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:bg-white transition-all resize-none text-slate-700 font-medium placeholder:text-slate-300 shadow-inner"
              />
              {!isOnline && (
                <div className="absolute top-4 right-4 flex items-center gap-2 px-3 py-1 bg-amber-100 text-amber-700 rounded-lg text-[10px] font-black border border-amber-200">
                  OFFLINE: REDIRECTING TO MESH
                </div>
              )}
            </div>
            <button
              onClick={handleSendTest}
              className="group w-full py-5 bg-slate-900 text-white rounded-[24px] font-bold flex items-center justify-center gap-3 hover:bg-slate-800 transition-all shadow-2xl active:scale-95 border-b-4 border-slate-700 hover:border-b-2"
            >
              Broadcast into Mesh <Zap className="w-5 h-5 text-yellow-400 fill-yellow-400 group-hover:animate-bounce" />
            </button>
          </div>
        </div>

        {/* Store-and-Forward Queue */}
        <div className="xl:col-span-1 bg-white rounded-[40px] p-8 shadow-sm border border-slate-200 flex flex-col min-h-[400px]">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-amber-100 rounded-2xl text-amber-600">
                <Database className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">Relay Queue ({queue.length})</h3>
                <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-0.5">Local Buffer Storage</p>
              </div>
            </div>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto pr-2 custom-scrollbar">
            {queue.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center py-10 opacity-30">
                <Database className="w-12 h-12 mb-3" />
                <p className="font-bold italic text-sm text-center">Buffer clean. No packets pending.</p>
              </div>
            ) : (
              queue.map(msg => (
                <div key={msg.id} className={`p-5 rounded-3xl border-2 transition-all ${msg.type === 'CRDT_MUTATION' ? 'bg-indigo-50 border-indigo-100 shadow-indigo-100/50' : 'bg-slate-50 border-slate-100'} shadow-md`}>
                  <div className="flex justify-between items-start mb-3">
                    <p className={`text-xs font-black px-2 py-0.5 rounded-md ${msg.type === 'CRDT_MUTATION' ? 'bg-indigo-200 text-indigo-700' : 'bg-slate-200 text-slate-700'}`}>
                      {msg.type}
                    </p>
                    <span className="text-[10px] font-mono font-bold text-slate-400">ID: {msg.id.split('-').pop()}</span>
                  </div>
                  <p className="text-sm font-bold text-slate-900 mb-4 line-clamp-2">
                    {typeof msg.content === 'object' ? JSON.stringify(msg.content) : msg.content}
                  </p>
                  <div className="flex items-center justify-between pt-3 border-t border-slate-100/50">
                     <div className="flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-emerald-500 fill-emerald-50" />
                        <span className="text-[10px] font-bold text-slate-500">{msg.sender.split('-')[1].toUpperCase()}</span>
                     </div>
                     <div className="flex items-center gap-1">
                        <Share2 className="w-3 h-3 text-slate-300" />
                        <span className="text-[10px] font-black text-slate-400">{msg.hops.length} Hops</span>
                     </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Global Activity */}
        <div className="xl:col-span-1 bg-white rounded-[40px] p-8 shadow-sm border border-slate-200 flex flex-col">
          <div className="flex items-center gap-4 mb-8">
            <div className="p-3 bg-slate-100 rounded-2xl text-slate-600">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">Recent Activity</h3>
              <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-0.5">Historical Mesh Flow</p>
            </div>
          </div>
          
          <div className="flex-1 space-y-4 overflow-y-auto pr-2 custom-scrollbar">
            {relayLogs.length === 0 ? (
              <p className="text-center py-12 text-sm text-slate-300 italic">Network silence. Listening for activity...</p>
            ) : (
              relayLogs.map((log, idx) => (
                <div key={`${log.timestamp}-${idx}`} className="flex items-center justify-between p-4 bg-slate-50/50 rounded-2xl border border-slate-100 border-l-4 border-l-blue-500 group hover:bg-white transition-all">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-500/10 rounded-lg group-hover:bg-blue-500 group-hover:text-white transition-all">
                      <Send className="w-3 h-3" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-slate-900 uppercase tracking-tighter">RELAY_{log.type}</p>
                      <p className="text-[10px] text-slate-400 font-mono italic">#{log.id.split('-').pop()}</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-slate-400 bg-white px-2 py-1 rounded-lg shadow-sm">{new Date(log.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'})}</span>
                </div>
              ))
            )}
          </div>
          
          {isOnline && (
            <div className="mt-6 p-4 bg-emerald-50 rounded-2xl border border-emerald-100 flex items-center gap-3">
              <Zap className="w-4 h-4 text-emerald-600 animate-pulse" />
              <p className="text-[10px] font-bold text-emerald-800">REAL-TIME UPLINK ACTIVE: AUTO-FLUSH ENABLED</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
