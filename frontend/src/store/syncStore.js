import { create } from 'zustand';
import api from '../services/api';

const syncChannel = new BroadcastChannel('digital-delta-sync');

export const useSyncStore = create((set, get) => {
  // Initialize sync channel listener
  syncChannel.onmessage = (event) => {
    if (event.data.type === 'REMOTE_MUTATION') {
      const { mutation } = event.data;
      const { localMutations, mergeVectorClock } = get();
      
      // Update local state without re-broadcasting
      mergeVectorClock(mutation.vectorClock);
      set({ localMutations: [...localMutations, mutation] });
    }
  };

  return {
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
      const { localMutations, incrementClock } = get();
      const nodeId = mutation.nodeId || 'local';
      
      const newMutation = {
        ...mutation,
        vectorClock: incrementClock(nodeId),
        timestamp: Date.now(),
        id: `${nodeId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      };
      
      set({ localMutations: [...localMutations, newMutation] });
      
      // Broadcast to other tabs
      syncChannel.postMessage({ type: 'REMOTE_MUTATION', mutation: newMutation });
      
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

      // Check mesh connectivity simulation
      const { isOnline, enqueueMessage } = (await import('./meshStore.js')).default.getState();
      
      if (!isOnline) {
        console.log('[Sync] Offline: Offloading mutations to Mesh Relay');
        localMutations.forEach(mutation => {
          enqueueMessage({
            id: `mutation-${mutation.id}`,
            type: 'CRDT_MUTATION',
            data: mutation,
            sender: mutation.nodeId,
            hops: []
          });
        });
        
        set({ 
          localMutations: [],
          syncStatus: 'synced', // Optimistic mesh sync
          lastSyncTime: Date.now() 
        });
        return { success: true, viaMesh: true };
      }
      
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
  };
});

export default useSyncStore;
