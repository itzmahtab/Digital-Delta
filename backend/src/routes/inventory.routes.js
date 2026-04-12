import { Router } from 'express';

const router = Router();

const inventory = [
  { id: 'INV001', name: 'Medical Kits', category: 'medical', quantity: 150, unit: 'boxes', min_stock: 50, updated_at: Date.now() },
  { id: 'INV002', name: 'Water Containers', category: 'water', quantity: 320, unit: 'units', min_stock: 100, updated_at: Date.now() },
  { id: 'INV003', name: 'Food Packages', category: 'food', quantity: 45, unit: 'boxes', min_stock: 100, updated_at: Date.now() },
  { id: 'INV004', name: 'Blankets', category: 'shelter', quantity: 200, unit: 'units', min_stock: 80, updated_at: Date.now() },
  { id: 'INV005', name: 'Fuel Canisters', category: 'fuel', quantity: 30, unit: 'units', min_stock: 20, updated_at: Date.now() },
  { id: 'INV006', name: 'First Aid Supplies', category: 'medical', quantity: 85, unit: 'kits', min_stock: 40, updated_at: Date.now() },
];

router.get('/', (req, res) => {
  const { category } = req.query;
  
  let filtered = [...inventory];
  
  if (category) {
    filtered = filtered.filter(i => i.category === category);
  }
  
  res.json({ success: true, inventory: filtered });
});

router.patch('/:id', (req, res) => {
  const { id } = req.params;
  const { quantity } = req.body;
  
  const item = inventory.find(i => i.id === id);
  if (!item) {
    return res.status(404).json({ 
      error: 'NOT_FOUND',
      message: 'Inventory item not found' 
    });
  }
  
  if (quantity !== undefined) {
    item.quantity = quantity;
    item.updated_at = Date.now();
  }
  
  res.json({ success: true, item });
});

export default router;
