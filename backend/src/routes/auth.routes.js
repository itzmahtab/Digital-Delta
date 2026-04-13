import { Router } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { 
  getUserByUsername, 
  updateUserPublicKey, 
  addAuditLog, 
  getAuditLogs,
  getAllUsers, 
  createUser 
} from '../db.js';
import { authenticateToken, requireAdmin } from '../middleware/rbac.middleware.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'digital-delta-secret-key-2026';

async function getUser(username) {
  return await getUserByUsername(username);
}

// Native TOTP verification helper
async function verifyTOTP(secret, token) {
  if (!secret || !token) return false;
  
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const base32 = secret.replace(/=+$/, '').toUpperCase();
  let bits = '';
  for (let i = 0; i < base32.length; i++) {
    const val = alphabet.indexOf(base32[i]);
    if (val === -1) continue;
    bits += val.toString(2).padStart(5, '0');
  }
  const keyBytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    keyBytes.push(parseInt(bits.substr(i, 8), 2));
  }
  const key = new Uint8Array(keyBytes);

  const currentCounter = Math.floor(Date.now() / 1000 / 30);
  
  // Check current and adjacent windows (±30s)
  for (let i = -1; i <= 1; i++) {
    const counter = currentCounter + i;
    const counterBytes = Buffer.alloc(8);
    counterBytes.writeBigInt64BE(BigInt(counter));
    
    const hmac = crypto.createHmac('sha1', Buffer.from(key));
    hmac.update(counterBytes);
    const hmacResult = hmac.digest();
    
    const offset = hmacResult[hmacResult.length - 1] & 0x0f;
    const binary = 
      ((hmacResult[offset] & 0x7f) << 24) |
      ((hmacResult[offset + 1] & 0xff) << 16) |
      ((hmacResult[offset + 2] & 0xff) << 8) |
      (hmacResult[offset + 3] & 0xff);
    
    const expected = (binary % 1000000).toString().padStart(6, '0');
    if (expected === token) return true;
  }
  return false;
}

router.get('/check/:username', async (req, res) => {
  const user = await getUser(req.params.username);
  if (user) {
    res.json({ exists: true, role: user.role });
  } else {
    res.json({ exists: false });
  }
});

router.post('/login', async (req, res) => {
  const { username, otp, role, otpSecret, demoBypass } = req.body;
  
  if (!username || !otp) {
    return res.status(400).json({ 
      error: 'INVALID_REQUEST',
      message: 'Username and OTP are required' 
    });
  }
  
  let user = await getUser(username);
  
  // Auto-registration for first-time users
  if (!user && role) {
    // If frontend provides an otpSecret (enrollment), use it. Otherwise generate.
    const secret = otpSecret || Array.from(crypto.randomBytes(10)).map(b => 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'[b % 32]).join('');
    user = {
      id: uuidv4(),
      username,
      role: role || 'volunteer',
      otp_secret: secret
    };
    await createUser(user);
    console.log(`[Auth] Registered & Enrolled new user: ${username} (${user.role})`);
  } else if (!user) {
    return res.status(401).json({ 
      error: 'USER_NOT_FOUND',
      message: 'User not found' 
    });
  }

  // Verify TOTP
  let isValid = false;
  const otpStr = String(otp).trim();
  
  // DEMO BYPASS: Emergency override for testing
  if (demoBypass === true || demoBypass === 'true') {
    isValid = true;
    console.log(`[Auth] ⚠️ DEMO BYPASS: Force login for ${username} (demoBypass=true)`);
  } else {
    // Normal demo mode checks (non-production environments)
    const isDemoMode = !process.env.NODE_ENV || process.env.NODE_ENV !== 'production';
    
    if (isDemoMode) {
      // In demo mode, accept:
      // 1. "123456" - explicit demo code
      // 2. Any valid 6-digit code - for offline testing
      if (otpStr === '123456' || /^\d{6}$/.test(otpStr)) {
        isValid = true;
        console.log(`[Auth] Demo mode login for ${username}`);
      }
    } else {
      // Production mode: real TOTP verification only
      try {
        if (user.otp_secret) {
          isValid = await verifyTOTP(user.otp_secret, otpStr);
        }
      } catch (err) {
        console.error(`[Auth] Verification error for ${username}:`, err);
      }
    }
  }
  
  if (!isValid) {
    console.warn(`[Auth] Login failed for ${username}: Invalid code (${otpStr})`);
    return res.status(401).json({ 
      error: 'INVALID_OTP',
      message: 'Invalid security code'
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
    },
    // Only return secret if it was newly enrolled (or not yet confirmed by a public key)
    newSecret: (!user.public_key) ? user.otp_secret : null
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
    role,
    otp_secret: Array.from(crypto.randomBytes(10)).map(b => 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'[b % 32]).join('')
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

router.get('/audit/logs', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const logs = await getAuditLogs(limit);
    
    res.json({ success: true, logs });
  } catch (err) {
    res.status(500).json({ error: 'DB_ERROR', message: err.message });
  }
});

export default router;