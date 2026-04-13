import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDeliveries, createDelivery, updateDeliveryStatus, addAuditLog, getUserByUsername } from '../db.js';
import { authenticateToken, requireRole, requirePermission } from '../middleware/rbac.middleware.js';

const router = Router();

// All delivery routes require authentication
router.use(authenticateToken);

router.get('/', requirePermission('view_deliveries'), async (req, res) => {
  try {
    const { status } = req.query;
    const items = await getDeliveries(status);
    res.json({ success: true, deliveries: items });
  } catch (err) {
    res.status(500).json({ error: 'DB_ERROR', message: err.message });
  }
});

router.post('/', requirePermission('create_delivery'), async (req, res) => {
  try {
    const { cargo, priority, from_node_id, to_node_id, sla_hours = 24 } = req.body;
    
    if (!cargo || !from_node_id || !to_node_id) {
      return res.status(400).json({ 
        error: 'INVALID_REQUEST',
        message: 'cargo, from_node_id, and to_node_id are required' 
      });
    }

    const newDelivery = {
      id: 'D' + Date.now().toString().slice(-6),
      cargo_type: cargo,
      priority: priority || 'P2',
      from_node_id,
      to_node_id,
      sla_hours
    };

    await createDelivery(newDelivery);
    await addAuditLog(req.user.userId, 'DELIVERY_CREATED', 'success', { delivery_id: newDelivery.id });
    res.status(201).json({ success: true, delivery: newDelivery });
  } catch (err) {
    res.status(500).json({ error: 'DB_ERROR', message: err.message });
  }
});

router.patch('/:id/status', requirePermission('update_delivery'), async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    await updateDeliveryStatus(id, status);
    await addAuditLog(req.user.userId, 'DELIVERY_STATUS_UPDATED', 'success', { delivery_id: id, new_status: status });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'DB_ERROR', message: err.message });
  }
});

// The frontend handles PoD generation locally via QRGenerator.jsx
// This endpoint is for system-initiated PoD generation if needed.
router.post('/:id/pod/generate', requirePermission('view_deliveries'), async (req, res) => {
  const { id } = req.params;
  
  res.json({
    success: true,
    qrPayload: {
      delivery_id: id,
      timestamp: Date.now(),
      nonce: uuidv4(),
      hint: 'Sign this with your private key to complete handover'
    }
  });
});

// Verify PoD on the backend (Final check)
router.post('/:id/pod/verify', requirePermission('update_delivery'), async (req, res) => {
  const { id } = req.params;
  const { qrPayload } = req.body;
  
  try {
    await updateDeliveryStatus(id, 'delivered');
    await addAuditLog(req.user.userId, 'DELIVERY_POD_VERIFIED', 'success', { delivery_id: id });
    
    res.json({
      success: true,
      message: 'PoD verified and recorded in ledger'
    });
  } catch (err) {
    res.status(500).json({ error: 'VERIFICATION_FAILED', message: err.message });
  }
});

export default router;

