import { Router } from 'express';

const router = Router();

const vehicles = [
  { id: 'V001', type: 'truck', name: 'Alpha Transport', battery_pct: 85, current_node_id: 'N1', max_payload_kg: 1000, status: 'available' },
  { id: 'V002', type: 'boat', name: 'River Rescue', battery_pct: 100, current_node_id: 'N3', max_payload_kg: 500, status: 'in_use' },
  { id: 'V003', type: 'drone', name: 'Scout Alpha', battery_pct: 45, current_node_id: 'N2', max_payload_kg: 5, status: 'in_flight' },
  { id: 'V004', type: 'drone', name: 'Scout Bravo', battery_pct: 92, current_node_id: 'N1', max_payload_kg: 5, status: 'charging' },
];

const droneRendezvousPoints = [
  { id: 'RP001', lat: 25.0658, lng: 91.4073, node_id: 'N3', type: 'drone_only' },
  { id: 'RP002', lat: 24.9945, lng: 92.2611, node_id: 'N5', type: 'drone_only' },
];

router.get('/', (req, res) => {
  const { type } = req.query;
  
  let filtered = [...vehicles];
  
  if (type) {
    filtered = filtered.filter(v => v.type === type);
  }
  
  res.json({ success: true, vehicles: filtered });
});

router.post('/rendezvous', (req, res) => {
  const { boat_id, drone_id, payload_weight_kg = 0 } = req.body;
  
  const boat = vehicles.find(v => v.id === boat_id && v.type === 'boat');
  const drone = vehicles.find(v => v.id === drone_id && v.type === 'drone');
  
  if (!boat) {
    return res.status(404).json({ 
      error: 'BOAT_NOT_FOUND',
      message: 'Boat not found' 
    });
  }
  
  if (!drone) {
    return res.status(404).json({ 
      error: 'DRONE_NOT_FOUND',
      message: 'Drone not found' 
    });
  }
  
  const boatReach = 10;
  const droneRange = drone.battery_pct * 0.1;
  
  if (droneRange < 2) {
    return res.status(400).json({ 
      error: 'ERROR_OUT_OF_RANGE',
      message: 'Drone range insufficient for rendezvous' 
    });
  }
  
  const rendezvousPoint = {
    id: 'RP' + Date.now(),
    lat: (boat.current_node_id === 'N3' ? 25.0658 : 24.9945),
    lng: (boat.current_node_id === 'N3' ? 91.4073 : 92.2611),
    estimated_time_mins: 15,
    boat_id,
    drone_id
  };
  
  res.json({
    success: true,
    rendezvous_point: rendezvousPoint,
    message: 'Optimal rendezvous point calculated'
  });
});

router.post('/handoff', (req, res) => {
  const { delivery_id, boat_id, drone_id, rendezvous_point } = req.body;
  
  res.json({
    success: true,
    message: 'Ownership transfer initiated',
    handoff: {
      delivery_id,
      from_vehicle_id: boat_id,
      to_vehicle_id: drone_id,
      location: rendezvous_point,
      timestamp: Date.now()
    }
  });
});

export default router;
