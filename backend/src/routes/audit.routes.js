import { Router } from 'express';

const router = Router();

const auditLog = [];

router.get('/logs', (req, res) => {
  const { limit = 100, offset = 0 } = req.query;
  
  const logs = auditLog.slice(Number(offset), Number(offset) + Number(limit));
  
  res.json({ 
    success: true, 
    logs,
    total: auditLog.length
  });
});

router.post('/verify', (req, res) => {
  const { startHash, endHash } = req.query;
  
  let currentHash = startHash || 'GENESIS';
  let isValid = true;
  
  for (const log of auditLog) {
    if (log.prevHash !== currentHash) {
      isValid = false;
      break;
    }
    currentHash = log.hash;
  }
  
  if (endHash && currentHash !== endHash) {
    isValid = false;
  }
  
  res.json({ 
    success: true,
    isValid,
    verified: isValid ? auditLog.length : 0,
    message: isValid ? 'Hash chain is valid' : 'Hash chain integrity compromised'
  });
});

export default router;
