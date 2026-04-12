import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

const deliveries = [
  { id: 'D001', cargo: 'Medical Supplies', priority: 'P0', status: 'in_transit', from_node_id: 'N1', to_node_id: 'N3', assigned_vehicle_id: 'V001', sla_hours: 2, eta_minutes: 45, created_at: Date.now() - 3600000 },
  { id: 'D002', cargo: 'Food Packages', priority: 'P1', status: 'pending', from_node_id: 'N1', to_node_id: 'N4', assigned_vehicle_id: null, sla_hours: 6, eta_minutes: null, created_at: Date.now() },
  { id: 'D003', cargo: 'Water Containers', priority: 'P2', status: 'pending', from_node_id: 'N2', to_node_id: 'N3', assigned_vehicle_id: null, sla_hours: 24, eta_minutes: null, created_at: Date.now() },
  { id: 'D004', cargo: 'Blankets', priority: 'P3', status: 'delivered', from_node_id: 'N1', to_node_id: 'N5', assigned_vehicle_id: 'V002', sla_hours: 72, eta_minutes: 0, created_at: Date.now() - 86400000 },
  { id: 'D005', cargo: 'Insulin Kits', priority: 'P0', status: 'in_transit', from_node_id: 'N6', to_node_id: 'N3', assigned_vehicle_id: 'V003', sla_hours: 2, eta_minutes: 30, created_at: Date.now() - 1800000 },
];

const podReceipts = new Map();
const usedNonces = new Set();

router.get('/', (req, res) => {
  const { status, priority } = req.query;
  
  let filtered = [...deliveries];
  
  if (status) {
    filtered = filtered.filter(d => d.status === status);
  }
  
  if (priority) {
    filtered = filtered.filter(d => d.priority === priority);
  }
  
  res.json({ success: true, deliveries: filtered });
});

router.post('/', (req, res) => {
  const { cargo, priority, from_node_id, to_node_id, sla_hours = 24 } = req.body;
  
  if (!cargo || !from_node_id || !to_node_id) {
    return res.status(400).json({ 
      error: 'INVALID_REQUEST',
      message: 'cargo, from_node_id, and to_node_id are required' 
    });
  }
  
  const newDelivery = {
    id: 'D' + String(deliveries.length + 1).padStart(3, '0'),
    cargo,
    priority: priority || 'P2',
    status: 'pending',
    from_node_id,
    to_node_id,
    assigned_vehicle_id: null,
    sla_hours,
    eta_minutes: null,
    created_at: Date.now()
  };
  
  deliveries.push(newDelivery);
  
  res.status(201).json({ success: true, delivery: newDelivery });
});

router.patch('/:id/status', (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  
  const delivery = deliveries.find(d => d.id === id);
  if (!delivery) {
    return res.status(404).json({ 
      error: 'NOT_FOUND',
      message: 'Delivery not found' 
    });
  }
  
  delivery.status = status;
  
  res.json({ success: true, delivery });
});

router.post('/:id/pod/generate', (req, res) => {
  const { id } = req.params;
  const delivery = deliveries.find(d => d.id === id);
  
  if (!delivery) {
    return res.status(404).json({ 
      error: 'NOT_FOUND',
      message: 'Delivery not found' 
    });
  }
  
  const qrPayload = {
    delivery_id: id,
    sender_pubkey: req.body.sender_pubkey || 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgK...',
    payload_hash: 'sha256:' + Buffer.from(JSON.stringify({ id, timestamp: Date.now() })).toString('base64').substring(0, 16),
    timestamp: Date.now(),
    nonce: uuidv4(),
    signature: 'BASE64_SIGNATURE_PLACEHOLDER'
  };
  
  res.json({
    success: true,
    qrPayload
  });
});

router.post('/:id/pod/verify', (req, res) => {
  const { id } = req.params;
  const { qrPayload } = req.body;
  
  if (!qrPayload) {
    return res.status(400).json({ 
      error: 'INVALID_REQUEST',
      message: 'QR payload is required' 
    });
  }
  
  const { nonce } = qrPayload;
  
  if (usedNonces.has(nonce)) {
    return res.status(400).json({ 
      error: 'ERROR_NONCE_REPLAY',
      message: 'This delivery QR has already been used.' 
    });
  }
  
  usedNonces.add(nonce);
  
  podReceipts.set(nonce, {
    delivery_id: id,
    driver_sig: qrPayload.signature,
    recipient_sig: 'RECIPIENT_SIG',
    nonce,
    payload_hash: qrPayload.payload_hash,
    created_at: Date.now()
  });
  
  res.json({
    success: true,
    message: 'PoD verified successfully',
    receipt: podReceipts.get(nonce)
  });
});

router.get('/:id/custody', (req, res) => {
  const { id } = req.params;
  const receipts = Array.from(podReceipts.values()).filter(r => r.delivery_id === id);
  
  res.json({ success: true, custody_chain: receipts });
});

export default router;
