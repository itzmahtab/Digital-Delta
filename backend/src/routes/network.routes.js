import { Router } from 'express';

const router = Router();

// SSE Clients
let clients = [];

const networkState = {
  nodes: [
    { id: 'N1', name: 'Sylhet City Hub', type: 'central_command', lat: 24.8949, lng: 91.8687, is_flooded: false },
    { id: 'N2', name: 'Osmani Airport Node', type: 'supply_drop', lat: 24.9632, lng: 91.8668, is_flooded: false },
    { id: 'N3', name: 'Sunamganj Sadar Camp', type: 'relief_camp', lat: 25.0658, lng: 91.4073, is_flooded: false },
    { id: 'N4', name: 'Companyganj Outpost', type: 'relief_camp', lat: 25.0715, lng: 91.7554, is_flooded: false },
    { id: 'N5', name: 'Kanaighat Point', type: 'waypoint', lat: 24.9945, lng: 92.2611, is_flooded: false },
    { id: 'N6', name: 'Habiganj Medical', type: 'hospital', lat: 24.3840, lng: 91.4169, is_flooded: false },
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

// Broadcast network update to all SSE clients
function broadcastUpdate(type, data) {
  const payload = JSON.stringify({ type, ...data });
  clients.forEach(client => client.res.write(`data: ${payload}\n\n`));
}

router.get('/events', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });

  const clientId = Date.now();
  const newClient = { id: clientId, res };
  clients.push(newClient);

  req.on('close', () => {
    clients = clients.filter(c => c.id !== clientId);
  });
});

router.get('/status', (req, res) => {
  res.json({
    success: true,
    timestamp: new Date().toISOString(),
    ...networkState
  });
});

router.post('/flood', (req, res) => {
  const { edge_id } = req.body;
  
  const edge = networkState.edges.find(e => e.id === edge_id);
  if (!edge) {
    return res.status(404).json({ 
      error: 'EDGE_NOT_FOUND',
      message: `Edge ${edge_id} not found` 
    });
  }
  
  edge.is_flooded = true;
  broadcastUpdate('EDGE_FLOODED', { edgeId: edge_id, edge });
  
  res.json({
    success: true,
    message: `Edge ${edge_id} marked as flooded`,
    edge
  });
});



router.post('/reset', (req, res) => {
  networkState.edges.forEach(edge => {
    edge.is_flooded = false;
  });
  
  broadcastUpdate('NETWORK_RESET', { edges: networkState.edges });
  
  res.json({
    success: true,
    message: 'Network reset to default state',
    edges: networkState.edges
  });
});

export default router;

