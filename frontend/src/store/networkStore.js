import { create } from 'zustand';

export const useNetworkStore = create((set, get) => ({
  isOnline: navigator.onLine,
  connectionType: 'unknown',
  latency: null,
  lastChecked: null,

  setOnline: (status) => set({ isOnline: status }),
  setConnectionType: (type) => set({ connectionType: type }),
  setLatency: (ms) => set({ latency: ms, lastChecked: Date.now() }),

  initNetworkListeners: () => {
    const { setOnline, setConnectionType } = get();
    
    window.addEventListener('online', () => setOnline(true));
    window.addEventListener('offline', () => setOnline(false));
    
    if ('connection' in navigator) {
      const connection = navigator.connection;
      setConnectionType(connection.effectiveType);
      
      connection.addEventListener('change', () => {
        setConnectionType(connection.effectiveType);
      });
    }
  },

  checkConnectivity: async (url = '/api/network/status') => {
    const start = Date.now();
    
    try {
      const response = await fetch(url, {
        method: 'HEAD',
        cache: 'no-cache'
      });
      
      const latency = Date.now() - start;
      get().setLatency(latency);
      get().setOnline(true);
      
      return { online: true, latency };
    } catch (error) {
      get().setOnline(false);
      return { online: false, latency: null };
    }
  },

  getStatusColor: () => {
    const { isOnline } = get();
    if (!isOnline) return '#C0392B';
    return '#1E8449';
  },

  getStatusText: () => {
    const { isOnline, latency } = get();
    if (!isOnline) return 'Offline Mode';
    if (latency !== null && latency > 2000) return 'Slow Connection';
    return 'Connected';
  },
}));

export default useNetworkStore;
