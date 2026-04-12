import { Router } from 'express';

const router = Router();

const serverVectorClock = {
  server: 0,
  devices: {}
};

const crdtLedger = [];
const conflicts = [];

router.get('/vector-clock', (req, res) => {
  res.json({
    success: true,
    vectorClock: serverVectorClock
  });
});

router.post('/delta', (req, res) => {
  const { mutations = [] } = req.body;
  
  serverVectorClock.server++;
  
  const incomingConflicts = [];
  const acceptedMutations = [];
  
  for (const mutation of mutations) {
    const { type, record_id, value, vectorClock, nodeId } = mutation;
    
    const existingMutation = crdtLedger.find(m => m.record_id === record_id);
    
    if (existingMutation) {
      const existingTime = existingMutation.timestamp || 0;
      const incomingTime = mutation.timestamp || 0;
      
      if (incomingTime > existingTime) {
        existingMutation.value = value;
        existingMutation.vectorClock = vectorClock;
        acceptedMutations.push(mutation);
      } else if (incomingTime === existingTime) {
        if (nodeId > existingMutation.nodeId) {
          existingMutation.value = value;
          existingMutation.vectorClock = vectorClock;
          acceptedMutations.push(mutation);
        } else {
          incomingConflicts.push({
            id: `conflict-${Date.now()}-${Math.random()}`,
            record_id,
            localValue: value,
            remoteValue: existingMutation.value,
            localVectorClock: vectorClock,
            remoteVectorClock: existingMutation.vectorClock
          });
        }
      }
    } else {
      crdtLedger.push({
        type,
        record_id,
        value,
        vectorClock,
        nodeId,
        timestamp: mutation.timestamp,
        synced_at: Date.now()
      });
      acceptedMutations.push(mutation);
    }
    
    if (nodeId) {
      serverVectorClock.devices[nodeId] = (serverVectorClock.devices[nodeId] || 0) + 1;
    }
  }
  
  if (incomingConflicts.length > 0) {
    conflicts.push(...incomingConflicts);
  }
  
  res.json({
    success: true,
    serverDelta: acceptedMutations,
    conflicts: incomingConflicts,
    serverVectorClock
  });
});

router.post('/resolve-conflict', (req, res) => {
  const { conflictId, resolution, resolvedValue } = req.body;
  
  const conflictIndex = conflicts.findIndex(c => c.id === conflictId);
  if (conflictIndex === -1) {
    return res.status(404).json({ 
      error: 'CONFLICT_NOT_FOUND',
      message: 'Conflict not found' 
    });
  }
  
  const conflict = conflicts[conflictIndex];
  conflict.resolution = resolution;
  conflict.resolvedValue = resolvedValue;
  conflict.resolved_at = Date.now();
  
  const record = crdtLedger.find(r => r.record_id === conflict.record_id);
  if (record) {
    record.value = resolvedValue;
    record.resolved = true;
  }
  
  conflicts.splice(conflictIndex, 1);
  
  res.json({ success: true });
});

export default router;
