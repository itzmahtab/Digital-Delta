import { create } from 'zustand';
import api from '../services/api';

export const useSyncStore = create((set, get) => ({
  vectorClock: {},
  localMutations: [],
  pendingConflicts: [],
  syncStatus: 'idle',
  lastSyncTime: null,
  isSyncing: false,
  error: null,

  setVectorClock: (vc) => set({ vectorClock: vc }),

  incrementClock: (nodeId) => {
    const { vectorClock } = get();
    const newClock = {
      ...vectorClock,
      [nodeId]: (vectorClock[nodeId] || 0) + 1
    };
    set({ vectorClock: newClock });
    return newClock;
  },

  mergeVectorClock: (remoteClock) => {
    const { vectorClock } = get();
    const merged = { ...vectorClock };
    
    Object.keys(remoteClock).forEach(nodeId => {
      merged[nodeId] = Math.max(merged[nodeId] || 0, remoteClock[nodeId]);
    });
    
    set({ vectorClock: merged });
    return merged;
  },

  addMutation: (mutation) => {
    const { localMutations, incrementClock, vectorClock } = get();
    const nodeId = mutation.nodeId || 'local';
    
    const newMutation = {
      ...mutation,
      vectorClock: incrementClock(nodeId),
      timestamp: Date.now(),
      id: `${nodeId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    };
    
    set({ localMutations: [...localMutations, newMutation] });
    return newMutation;
  },

  addConflict: (conflict) => {
    const { pendingConflicts } = get();
    if (!pendingConflicts.find(c => c.id === conflict.id)) {
      set({ pendingConflicts: [...pendingConflicts, conflict] });
    }
  },

  resolveConflict: async (conflictId, resolution) => {
    const { pendingConflicts } = get();
    const conflict = pendingConflicts.find(c => c.id === conflictId);
    
    if (!conflict) return { success: false, error: 'Conflict not found' };
    
    try {
      await api.post('/api/sync/resolve-conflict', {
        conflictId,
        resolution,
        resolvedValue: resolution === 'keep_local' ? conflict.localValue : conflict.remoteValue
      });
      
      set({ pendingConflicts: pendingConflicts.filter(c => c.id !== conflictId) });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  sync: async () => {
    const { localMutations, vectorClock, syncStatus } = get();
    if (syncStatus === 'syncing') return;
    
    set({ isSyncing: true, syncStatus: 'syncing', error: null });
    
    try {
      const response = await api.post('/api/sync/delta', {
        sinceVectorClock: vectorClock,
        mutations: localMutations
      });
      
      const { serverDelta, conflicts, serverVectorClock } = response.data;
      
      if (conflicts && conflicts.length > 0) {
        conflicts.forEach(conflict => get().addConflict(conflict));
        set({ syncStatus: 'conflict' });
      } else {
        set({ syncStatus: 'synced' });
      }
      
      get().mergeVectorClock(serverVectorClock);
      set({
        localMutations: [],
        lastSyncTime: Date.now(),
        isSyncing: false
      });
      
      return { success: true, serverDelta };
    } catch (error) {
      set({ 
        syncStatus: 'error', 
        error: error.message,
        isSyncing: false 
      });
      return { success: false, error: error.message };
    }
  },

  fetchServerVectorClock: async () => {
    try {
      const response = await api.get('/api/sync/vector-clock');
      set({ vectorClock: response.data.vectorClock });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  clearErrors: () => set({ error: null }),
}));

export default useSyncStore;
