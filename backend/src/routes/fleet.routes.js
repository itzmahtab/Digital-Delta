import { Router } from 'express';
import { getVehicles, addAuditLog } from '../db.js';
import { authenticateToken, requirePermission } from '../middleware/rbac.middleware.js';

const router = Router();

// All fleet routes require authentication
router.use(authenticateToken);

router.get('/', requirePermission('view_fleet'), async (req, res) => {
  try {
    const { type } = req.query;
    let allVehicles = await getVehicles();
    
    if (type) {
      allVehicles = allVehicles.filter(v => v.type === type);
    }
    
    res.json({ success: true, vehicles: allVehicles });
  } catch (err) {
    res.status(500).json({ error: 'DB_ERROR', message: err.message });
  }
});

router.post('/rendezvous', requirePermission('update_fleet_status'), async (req, res) => {
  try {
    const { boat_id, drone_id } = req.body;
    const allVehicles = await getVehicles();
    
    const boat = allVehicles.find(v => v.id === boat_id && v.type === 'boat');
    const drone = allVehicles.find(v => v.id === drone_id && v.type === 'drone');
    
    if (!boat) return res.status(404).json({ error: 'BOAT_NOT_FOUND' });
    if (!drone) return res.status(404).json({ error: 'DRONE_NOT_FOUND' });
    
    const rendezvousPoint = {
      id: 'RP' + Date.now(),
      lat: (boat.current_node_id === 'N4' ? 24.8 : 25.0658),
      lng: (boat.current_node_id === 'N4' ? 91.4 : 91.4073),
      estimated_time_mins: 15,
      boat_id,
      drone_id
    };

    await addAuditLog(req.user.userId, 'RENDEZVOUS_PLANNED', 'success', { 
      boat_id, 
      drone_id, 
      rendezvous_id: rendezvousPoint.id 
    });
    
    res.json({ success: true, rendezvous_point: rendezvousPoint });
  } catch (err) {
    res.status(500).json({ error: 'DB_ERROR', message: err.message });
  }
});

export default router;

