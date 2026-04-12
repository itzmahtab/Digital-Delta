import { Router } from 'express';
import { getInventory, updateInventoryItem } from '../db.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const { category } = req.query;
    const items = await getInventory(category);
    res.json({ success: true, inventory: items });
  } catch (err) {
    res.status(500).json({ error: 'DB_ERROR', message: err.message });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { quantity } = req.body;
    
    if (quantity === undefined) {
      return res.status(400).json({ error: 'INVALID_REQUEST', message: 'quantity is required' });
    }

    await updateInventoryItem(id, quantity);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'DB_ERROR', message: err.message });
  }
});

export default router;

