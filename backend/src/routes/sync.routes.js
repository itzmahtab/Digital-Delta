import { Router } from 'express';
import { getLedgerDelta, appendLedgerMutation } from '../db.js';

const router = Router();

const serverVectorClock = {
  server: 0,
  devices: {}
};

router.get('/vector-clock', (req, res) => {
  res.json({
    success: true,
    vectorClock: serverVectorClock
  });
});

router.post('/delta', async (req, res) => {
  try {
    const { mutations = [], sinceVectorClock } = req.body;
    
    serverVectorClock.server++;
    
    const acceptedMutations = [];
    
    for (const mutation of mutations) {
      // Append to persistent ledger
      await appendLedgerMutation({
        type: mutation.type,
        record_id: mutation.record_id,
        data: mutation.data || mutation.value,
        vectorClock: mutation.vectorClock,
        nodeId: mutation.nodeId,
        timestamp: mutation.timestamp
      });
      acceptedMutations.push(mutation);
      
      if (mutation.nodeId) {
        serverVectorClock.devices[mutation.nodeId] = (serverVectorClock.devices[mutation.nodeId] || 0) + 1;
      }
    }
    
    // Fetch all updates from the server that the client might be missing
    const serverDelta = await getLedgerDelta(sinceVectorClock);
    
    res.json({
      success: true,
      serverDelta,
      conflicts: [], // Simplified for demo; real system would return conflicts
      serverVectorClock
    });
  } catch (err) {
    res.status(500).json({ error: 'SYNC_ERROR', message: err.message });
  }
});

router.post('/resolve-conflict', (req, res) => {
  // Logic moved to a simplified model for demo
  res.json({ success: true });
});

export default router;

