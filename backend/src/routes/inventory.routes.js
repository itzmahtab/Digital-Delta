import { Router } from 'express';
import { getInventory, updateInventoryItem, addAuditLog } from '../db.js';
import { authenticateToken, requirePermission } from '../middleware/rbac.middleware.js';

const router = Router();

// All inventory routes require authentication
router.use(authenticateToken);

router.get('/', requirePermission('view_inventory'), async (req, res) => {
  try {
    const { category } = req.query;
    const items = await getInventory(category);
    res.json({ success: true, inventory: items });
  } catch (err) {
    res.status(500).json({ error: 'DB_ERROR', message: err.message });
  }
});

router.patch('/:id', requirePermission('manage_inventory'), async (req, res) => {
  try {
    const { id } = req.params;
    const { quantity } = req.body;
    
    if (quantity === undefined) {
      return res.status(400).json({ error: 'INVALID_REQUEST', message: 'quantity is required' });
    }

    await updateInventoryItem(id, quantity);
    await addAuditLog(req.user.userId, 'INVENTORY_UPDATED', 'success', { item_id: id, new_quantity: quantity });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'DB_ERROR', message: err.message });
  }
});

export default router;

