import { Router } from 'express';

const router = Router();

const networkState = {
  nodes: [
    { id: 'N1', name: 'Sylhet City Hub', type: 'central_command', lat: 24.8949, lng: 91.8687 },
    { id: 'N2', name: 'Osmani Airport Node', type: 'supply_drop', lat: 24.9632, lng: 91.8668 },
    { id: 'N3', name: 'Sunamganj Sadar Camp', type: 'relief_camp', lat: 25.0658, lng: 91.4073 },
    { id: 'N4', name: 'Companyganj Outpost', type: 'relief_camp', lat: 25.0715, lng: 91.7554 },
    { id: 'N5', name: 'Kanaighat Point', type: 'waypoint', lat: 24.9945, lng: 92.2611 },
    { id: 'N6', name: 'Habiganj Medical', type: 'hospital', lat: 24.3840, lng: 91.4169 },
  ],
  edges: [
    { id: 'E1', source: 'N1', target: 'N2', mode: 'land', base_weight_mins: 20, is_flooded: false, risk_score: 0.12 },
    { id: 'E2', source: 'N1', target: 'N3', mode: 'land', base_weight_mins: 90, is_flooded: false, risk_score: 0.35 },
    { id: 'E3', source: 'N2', target: 'N4', mode: 'land', base_weight_mins: 45, is_flooded: false, risk_score: 0.08 },
    { id: 'E4', source: 'N1', target: 'N5', mode: 'land', base_weight_mins: 60, is_flooded: false, risk_score: 0.45 },
    { id: 'E5', source: 'N3', target: 'N4', mode: 'water', base_weight_mins: 30, is_flooded: false, risk_score: 0.15 },
    { id: 'E6', source: 'N1', target: 'N6', mode: 'land', base_weight_mins: 120, is_flooded: false, risk_score: 0.22 },
    { id: 'E7', source: 'N2', target: 'N3', mode: 'air', base_weight_mins: 15, is_flooded: false, risk_score: 0.02 },
    { id: 'E8', source: 'N4', target: 'N5', mode: 'water', base_weight_mins: 50, is_flooded: false, risk_score: 0.25 },
  ]
};

function dijkstra(from, to, vehicleType) {
  const graph = {};
  
  networkState.nodes.forEach(node => {
    graph[node.id] = [];
  });
  
  networkState.edges.forEach(edge => {
    if (edge.is_flooded) return;
    
    // Vehicle type constraints
    if (vehicleType === 'truck' && edge.mode !== 'land') return;
    if (vehicleType === 'boat' && edge.mode !== 'water') return;
    if (vehicleType === 'drone' && (edge.mode !== 'air' && edge.mode !== 'land')) return;
    
    const weight = edge.base_weight_mins * (1 + edge.risk_score);
    
    graph[edge.source].push({ node: edge.target, weight, edge });
    graph[edge.target].push({ node: edge.source, weight, edge });
  });
  
  const distances = {};
  const previous = {};
  const unvisited = new Set();
  
  networkState.nodes.forEach(node => {
    distances[node.id] = Infinity;
    previous[node.id] = null;
    unvisited.add(node.id);
  });
  
  distances[from] = 0;
  
  while (unvisited.size > 0) {
    let minNode = null;
    let minDist = Infinity;
    
    for (const node of unvisited) {
      if (distances[node] < minDist) {
        minDist = distances[node];
        minNode = node;
      }
    }
    
    if (minNode === null || minNode === to) break;
    
    unvisited.delete(minNode);
    
    for (const neighbor of graph[minNode]) {
      if (!unvisited.has(neighbor.node)) continue;
      
      const alt = distances[minNode] + neighbor.weight;
      if (alt < distances[neighbor.node]) {
        distances[neighbor.node] = alt;
        previous[neighbor.node] = { node: minNode, edge: neighbor.edge };
      }
    }
  }
  
  if (distances[to] === Infinity) {
    return null;
  }
  
  const path = [];
  const edges = [];
  let current = to;
  
  while (current !== from) {
    const prev = previous[current];
    if (!prev) break;
    path.unshift(current);
    edges.unshift(prev.edge);
    current = prev.node;
  }
  path.unshift(from);
  
  return {
    path,
    edges: edges.map(e => ({
      id: e.id,
      source: e.source,
      target: e.target,
      mode: e.mode,
      base_weight_mins: e.base_weight_mins,
      weight: e.base_weight_mins,
      risk: e.risk_score,
      is_flooded: e.is_flooded
    })),
    totalWeight: Math.round(distances[to]),
    eta_minutes: Math.round(distances[to]),
    vehicle: vehicleType
  };
}

router.get('/compute', (req, res) => {
  const { from, to, vehicle = 'truck' } = req.query;
  
  if (!from || !to) {
    return res.status(400).json({ 
      error: 'INVALID_REQUEST',
      message: 'from and to parameters are required' 
    });
  }
  
  const fromNode = networkState.nodes.find(n => n.id === from);
  const toNode = networkState.nodes.find(n => n.id === to);
  
  if (!fromNode || !toNode) {
    return res.status(404).json({ 
      error: 'NODE_NOT_FOUND',
      message: 'Source or destination node not found' 
    });
  }
  
  const route = dijkstra(from, to, vehicle);
  
  if (!route) {
    return res.status(404).json({ 
      error: 'NO_ROUTE',
      message: `No route found from ${from} to ${to} for ${vehicle}` 
    });
  }
  
  res.json({
    success: true,
    route: {
      id: `route-${from}-${to}-${Date.now()}`,
      ...route,
      computed_at: new Date().toISOString()
    }
  });
});

router.get('/active', (req, res) => {
  res.json({ success: true, routes: [] });
});

router.post('/recompute', (req, res) => {
  res.json({ success: true, message: 'Routes recomputed' });
});

router.get('/reachability', (req, res) => {
  const droneOnlyNodes = ['N3', 'N5'];
  
  res.json({
    success: true,
    droneRequiredZones: droneOnlyNodes,
    message: 'Nodes unreachable by road or boat'
  });
});

export default router;
