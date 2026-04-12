import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { getUserByUsername, getAllUsers, createUser, updateUserPublicKey, addAuditLog } from '../db.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'digital-delta-secret-key-2026';

async function getUser(username) {
  return await getUserByUsername(username);
}

async function listUsers() {
  const usersArray = await getAllUsers();
  const usersMap = new Map();
  usersArray.forEach(user => {
    usersMap.set(user.username, user);
  });
  return usersMap;
}

router.post('/login', async (req, res) => {
  const { username, otp } = req.body;
  
  if (!username || !otp) {
    return res.status(400).json({ 
      error: 'INVALID_REQUEST',
      message: 'Username and OTP are required' 
    });
  }
  
  if (otp.length !== 6 || !/^\d+$/.test(otp)) {
    return res.status(401).json({ 
      error: 'INVALID_OTP',
      message: 'OTP must be 6 digits' 
    });
  }
  
  const user = await getUser(username);
  if (!user) {
    return res.status(401).json({ 
      error: 'USER_NOT_FOUND',
      message: 'User not found' 
    });
  }
  
  const token = jwt.sign(
    { 
      userId: user.id, 
      username: user.username, 
      role: user.role 
    },
    JWT_SECRET,
    { expiresIn: '24h' }
  );

  await addAuditLog(user.id, 'LOGIN', 'success', { deviceId: req.body.deviceId });
  
  res.json({
    success: true,
    token,
    user: {
      id: user.id,
      username: user.username,
      role: user.role
    }
  });
});

router.post('/register', async (req, res) => {
  const { username, role = 'volunteer' } = req.body;
  
  if (!username) {
    return res.status(400).json({ 
      error: 'USERNAME_REQUIRED',
      message: 'Username is required' 
    });
  }
  
  const existingUser = await getUser(username);
  if (existingUser) {
    return res.status(409).json({ 
      error: 'USER_EXISTS',
      message: 'Username already exists' 
    });
  }
  
  const newUser = {
    id: uuidv4(),
    username,
    passwordHash: null,
    role,
    publicKey: null,
    deviceId: null
  };
  
  await createUser(newUser);
  await addAuditLog(newUser.id, 'USER_REGISTER', 'success', { role });
  
  res.status(201).json({
    success: true,
    user: {
      id: newUser.id,
      username: newUser.username,
      role: newUser.role
    }
  });
});

router.post('/register-key', authenticateToken, async (req, res) => {
  const { publicKey } = req.body;
  const user = await getUser(req.user.username);
  
  if (!publicKey) {
    return res.status(400).json({ 
      error: 'PUBLIC_KEY_REQUIRED',
      message: 'Public key is required' 
    });
  }

  await updateUserPublicKey(req.user.username, publicKey, req.body.deviceId || uuidv4());
  
  await addAuditLog(user.id, 'KEY_REGISTER', 'success', { deviceId: req.body.deviceId });
  
  res.json({ success: true });
});

router.post('/refresh', authenticateToken, (req, res) => {
  const newToken = jwt.sign(
    { 
      userId: req.user.userId, 
      username: req.user.username, 
      role: req.user.role 
    },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
  
  res.json({ token: newToken });
});

router.get('/audit/logs', authenticateToken, async (req, res) => {
  if (!['admin', 'commander'].includes(req.user.role)) {
    return res.status(403).json({ 
      error: 'FORBIDDEN',
      message: 'Insufficient permissions' 
    });
  }
  
  const limit = parseInt(req.query.limit) || 100;
  const logs = await getAuditLogs(limit);
  
  res.json({ logs });
});

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ 
      error: 'UNAUTHORIZED',
      message: 'Access token required' 
    });
  }
  
  jwt.verify(token, JWT_SECRET, async (err, user) => {
    if (err) {
      return res.status(403).json({ 
        error: 'INVALID_TOKEN',
        message: 'Invalid or expired token' 
      });
    }
    
    const dbUser = await getUser(user.username);
    if (!dbUser) {
      return res.status(403).json({ 
        error: 'USER_NOT_FOUND',
        message: 'User no longer exists' 
      });
    }
    
    req.user = user;
    next();
  });
}

export default router;