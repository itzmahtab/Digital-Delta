import { create } from 'zustand';
import api from '../services/api';

export const useRouteStore = create((set, get) => {
  let eventSource = null;

  return {
    graph: null,
    nodes: [],
    edges: [],
    activeRoutes: [],
    failedEdges: [],
    mlPredictions: {},
    isLoading: false,
    error: null,

    setGraph: (graph) => set({ graph, nodes: graph.nodes || [], edges: graph.edges || [] }),
    setNodes: (nodes) => set({ nodes }),
    setEdges: (edges) => set({ edges }),

    subscribeToEvents: () => {
      if (eventSource) return;

      const url = `${api.defaults.baseURL || 'http://localhost:3001'}/api/network/events`;
      eventSource = new EventSource(url);

      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);
        const { type } = data;

        if (type === 'EDGE_FLOODED') {
          const { edgeId } = data;
          const { failedEdges } = get();
          if (!failedEdges.includes(edgeId)) {
            set({ failedEdges: [...failedEdges, edgeId] });
            // Update the specific edge in the edges array
            set({
              edges: get().edges.map(e => e.id === edgeId ? { ...e, is_flooded: true } : e)
            });
            get().recomputeRoutes();
          }
        } else if (type === 'NETWORK_RESET') {
          const { edges } = data;
          set({ 
            failedEdges: [],
            edges: edges
          });
          get().recomputeRoutes();
        }
      };

      eventSource.onerror = (err) => {
        console.error('SSE Error:', err);
        eventSource.close();
        eventSource = null;
        // Reconnect after delay
        setTimeout(() => get().subscribeToEvents(), 5000);
      };
    },

    unsubscribeFromEvents: () => {
      if (eventSource) {
        eventSource.close();
        eventSource = null;
      }
    },

    addFailedEdge: (edgeId) => {
      const { failedEdges } = get();
      if (!failedEdges.includes(edgeId)) {
        set({ failedEdges: [...failedEdges, edgeId] });
        get().recomputeRoutes();
      }
    },

    removeFailedEdge: (edgeId) => {
      const { failedEdges } = get();
      set({ failedEdges: failedEdges.filter(id => id !== edgeId) });
      get().recomputeRoutes();
    },

    setMlPredictions: (predictions) => {
      const predictionMap = {};
      predictions.forEach(p => {
        predictionMap[p.edge_id] = {
          probability: p.probability,
          label: p.label,
          risk: p.probability > 0.7 ? 'high' : p.probability > 0.3 ? 'medium' : 'low'
        };
      });
      set({ mlPredictions: predictionMap });
    },

    computeRoute: async (from, to, vehicleType) => {
      set({ isLoading: true, error: null });
      try {
        const response = await api.get('/api/routes/compute', {
          params: { from, to, vehicle: vehicleType }
        });
        const route = response.data.route;
        
        // Check if truck route is flooded and suggest boat
        let suggestion = null;
        if (vehicleType === 'truck') {
          const { suggestion: boatSuggestion, isFlooded } = await get().suggestBoatDispatch(from, to, route);
          suggestion = boatSuggestion;
          route.floodWarning = isFlooded;
          route.boatSuggestion = boatSuggestion;
        }
        
        const { activeRoutes } = get();
        set({
          activeRoutes: [...activeRoutes.filter(r => r.id !== route.id), route],
          isLoading: false
        });
        
        return { success: true, route, suggestion };
      } catch (error) {
        set({ error: error.message, isLoading: false });
        return { success: false, error: error.message };
      }
    },

    recomputeRoutes: async () => {
      const { activeRoutes } = get();
      if (activeRoutes.length === 0) return;
      
      set({ isLoading: true });
      try {
        await api.post('/api/routes/recompute');
        set({ isLoading: false });
      } catch (error) {
        set({ error: error.message, isLoading: false });
      }
    },

    fetchNetworkStatus: async () => {
      try {
        const response = await api.get('/api/network/status');
        const { nodes, edges } = response.data;
        set({ nodes, edges });
        
        const floodedEdges = edges.filter(e => e.is_flooded).map(e => e.id);
        set({ failedEdges: floodedEdges });
      } catch (error) {
        console.error('Failed to fetch network status:', error);
      }
    },

    triggerFlood: async (edgeId) => {
      try {
        await api.post('/api/network/flood', { edge_id: edgeId });
        // No need to call addFailedEdge here as SSE will handle it
        return { success: true };
      } catch (error) {
        return { success: false, error: error.message };
      }
    },

    resetNetwork: async () => {
      try {
        await api.post('/api/network/reset');
        // No need to clear locally as SSE will handle it
        return { success: true };
      } catch (error) {
        return { success: false, error: error.message };
      }
    },

    getEdgeRisk: (edgeId) => {
      const { mlPredictions, edges } = get();
      const prediction = mlPredictions[edgeId];
      if (prediction) return prediction;
      
      const edge = edges.find(e => e.id === edgeId);
      return edge ? { probability: edge.risk_score || 0, risk: 'unknown' } : null;
    },

    getRouteColor: (edgeId) => {
      const risk = get().getEdgeRisk(edgeId);
      if (!risk) return '#2E86C1';
      if (risk.risk === 'high') return '#C0392B';
      if (risk.risk === 'medium') return '#F39C12';
      return '#1E8449';
    },

    checkRouteFlooded: (route) => {
      if (!route || !route.edges) return false;
      const { failedEdges } = get();
      return route.edges.some(edge => failedEdges.includes(edge.id));
    },

    suggestBoatDispatch: async (from, to, truckRoute) => {
      const isFlooded = get().checkRouteFlooded(truckRoute);
      if (!isFlooded) {
        return { suggestion: null, isFlooded: false };
      }
      
      // Truck route is flooded, suggest boat as alternative
      try {
        const response = await api.get('/api/routes/compute', {
          params: { from, to, vehicle: 'boat' }
        });
        return { 
          suggestion: {
            alternativeVehicle: 'boat',
            alternativeRoute: response.data.route,
            reason: 'truck_route_flooded'
          },
          isFlooded: true 
        };
      } catch (error) {
        return { 
          suggestion: {
            alternativeVehicle: 'boat',
            reason: 'truck_route_flooded',
            error: error.message
          },
          isFlooded: true 
        };
      }
    },
  };
});

export default useRouteStore;