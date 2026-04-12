import { create } from 'zustand';
import api from '../services/api';
export const useRouteStore = create((set, get) => ({
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
      
      const { activeRoutes } = get();
      set({
        activeRoutes: [...activeRoutes.filter(r => r.id !== route.id), route],
        isLoading: false
      });
      
      return { success: true, route };
    } catch (error) {
      set({ error: error.message, isLoading: false });
      return { success: false, error: error.message };
    }
  },
  recomputeRoutes: async () => {
    const { activeRoutes } = get();
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
      get().addFailedEdge(edgeId);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },
  resetNetwork: async () => {
    try {
      await api.post('/api/network/reset');
      set({ failedEdges: [] });
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
}));
export default useRouteStore;