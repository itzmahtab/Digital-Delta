import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { initDatabase } from './db.js';
import authRoutes from './routes/auth.routes.js';
import networkRoutes from './routes/network.routes.js';
import routeRoutes from './routes/route.routes.js';
import deliveryRoutes from './routes/delivery.routes.js';
import syncRoutes from './routes/sync.routes.js';
import inventoryRoutes from './routes/inventory.routes.js';
import fleetRoutes from './routes/fleet.routes.js';
import auditRoutes from './routes/audit.routes.js';
import mlRoutes from './routes/ml.routes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/network', networkRoutes);
app.use('/api/routes', routeRoutes);
app.use('/api/deliveries', deliveryRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/fleet', fleetRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/ml', mlRoutes);

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    offline: false
  });
});

app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ 
    error: 'Internal Server Error',
    message: err.message 
  });
});

initDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`🏗️  Digital Delta API running on port ${PORT}`);
    console.log(`📍 Health: http://localhost:${PORT}/api/health`);
  });
}).catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});
