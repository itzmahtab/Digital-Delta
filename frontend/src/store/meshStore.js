import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useMeshStore = create(
  persist(
    (set, get) => {
      const meshChannel = new BroadcastChannel('digital-delta-mesh');

      meshChannel.onmessage = (event) => {
        const { type, data } = event.data;
        const { role, nodeId, neighbors, processQueue } = get();

        if (type === 'BEACON') {
          // Discovery: neighbor announced itself
          if (data.nodeId !== nodeId) {
            const newNeighbors = { ...neighbors, [data.nodeId]: { ...data, lastSeen: Date.now() } };
            set({ neighbors: newNeighbors });
          }
        } else if (type === 'MESSAGE_RELAY' && role === 'relay') {
          // Relay logic: if I'm a relay, take the message and try to forward it
          console.log(`[Mesh] Received message ${data.id} for relay`);
          get().enqueueMessage(data);
        }
      };

      return {
        nodeId: `node-${Math.random().toString(36).substr(2, 6)}`,
        role: 'client', // 'client' or 'relay'
        isOnline: true,
        status: 'active',
        neighbors: {},
        queue: [],
        relayLogs: [],

        setRole: (role) => set({ role }),
        setOnline: (isOnline) => set({ isOnline }),
        
        sendBeacon: () => {
          const { nodeId, role, isOnline } = get();
          meshChannel.postMessage({
            type: 'BEACON',
            data: { nodeId, role, isOnline, timestamp: Date.now() }
          });
        },

        enqueueMessage: (message) => {
          const { queue, role, isOnline } = get();
          
          // If we received a CRDT mutation and we are online, don't even queue it, just "consume" it
          // In a real system, the sync processor would handle this.
          
          const newMessage = {
            ...message,
            hops: [...(message.hops || []), get().nodeId],
            receivedAt: Date.now()
          };
          
          set({ queue: [...queue, newMessage] });
          
          if (role === 'relay' || isOnline) {
            get().processQueue();
          }
        },

        processQueue: async () => {
          const { queue, neighbors, nodeId, isOnline } = get();
          if (queue.length === 0) return;

          const updatedQueue = [...queue];
          const delivered = [];
          const mutationsToFlush = [];

          for (const msg of queue) {
            // Priority 1: If I'm online, flush CRDT mutations to server
            if (isOnline && msg.type === 'CRDT_MUTATION') {
              mutationsToFlush.push(msg.data);
              delivered.push(msg.id);
              continue;
            }

            // Priority 2: Forward to neighbors
            const potentialNextHop = Object.keys(neighbors).find(
              nId => !msg.hops.includes(nId) && (Date.now() - neighbors[nId].lastSeen < 10000)
            );

            if (potentialNextHop) {
              console.log(`[Mesh] Forwarding message ${msg.id} to ${potentialNextHop}`);
              meshChannel.postMessage({
                type: 'MESSAGE_RELAY',
                data: msg
              });
              delivered.push(msg.id);
            }
          }

          // If we have mutations to flush, send them to the server
          if (mutationsToFlush.length > 0) {
            try {
              const api = (await import('../services/api.js')).default;
              await api.post('/api/sync/delta', {
                mutations: mutationsToFlush,
                sinceVectorClock: {} // Relay doesn't care about delta, just pushing
              });
              console.log(`[Mesh] Successfully flushed ${mutationsToFlush.length} mutations to server`);
            } catch (err) {
              console.error('[Mesh] Failed to flush mutations:', err);
              // Don't mark as delivered if it failed
              mutationsToFlush.forEach(m => {
                const idx = delivered.indexOf(`mutation-${m.id}`);
                if (idx > -1) delivered.splice(idx, 1);
              });
            }
          }

          set({ 
            queue: updatedQueue.filter(m => !delivered.includes(m.id)),
            relayLogs: [
              ...delivered.map(id => ({ id, type: 'FORWARD', timestamp: Date.now() })),
              ...get().relayLogs
            ].slice(0, 50)
          });
        },

        cleanNeighbors: () => {
          const { neighbors } = get();
          const now = Date.now();
          const alive = {};
          Object.keys(neighbors).forEach(id => {
            if (now - neighbors[id].lastSeen < 15000) {
              alive[id] = neighbors[id];
            }
          });
          set({ neighbors: alive });
        }
      };
    },
    {
      name: 'digital-delta-mesh',
      partialize: (state) => ({ role: state.role, nodeId: state.nodeId }),
    }
  )
);

export default useMeshStore;
