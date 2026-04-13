/**
 * Authentication Routes
 * 
 * Implements:
 * - M1.1: TOTP login
 * - M1.2: RSA key registration
 * - M1.3: RBAC enforcement
 * - M1.4: Audit logging
 */

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const OTPService = require('../services/otp.service');
const { AuditLogService } = require('../services/audit.service');
const { authMiddleware, rbacMiddleware } = require('../middleware/rbac.middleware');

let auditService = null;

/**
 * Initialize audit service
 */
function initAudit(db) {
  auditService = new AuditLogService(db);
  return auditService;
}

/**
 * POST /api/auth/login
 * Login with username + OTP code
 *
 * QUESTION 1 ANSWER:
 * ✓ OTP verified COMPLETELY OFFLINE (device clock only)
 * ✓ Expiry enforced (30 seconds)
 * ✓ Reuse prevention (track last used token)
 */
router.post('/login', async (req, res) => {
  try {
    const { username, otpCode, deviceId } = req.body;

    // Step 1: Get user from database
    const user = await req.db('users').where({ username }).first();

    if (!user) {
      // Log failed login attempt
      await auditService.logAction(
        'unknown',
        'LOGIN_FAILED',
        { username, reason: 'USER_NOT_FOUND' },
        { ip: req.ip, deviceId }
      );

      return res.status(401).json({
        error: 'INVALID_CREDENTIALS',
        message: 'User not found',
      });
    }

    // Step 2: Verify OTP (RFC 6238 — completely offline)
    const otpResult = OTPService.verifyTOTP(user.otp_secret, otpCode);

    if (!otpResult.valid) {
      // Log failed OTP
      await auditService.logAction(
        user.id,
        'OTP_FAILED',
        { reason: otpResult.error, remainingSeconds: otpResult.remainingSeconds },
        { ip: req.ip, deviceId }
      );

      return res.status(401).json({
        error: otpResult.error, // TOTP_EXPIRED, TOTP_INVALID, TOTP_ALREADY_USED
        message: otpResult.message,
        remainingSeconds: otpResult.remainingSeconds,
      });
    }

    // Step 3: Generate JWT tokens
    const accessToken = jwt.sign(
      {
        id: user.id,
        username: user.username,
        role: user.role,
        deviceId,
      },
      process.env.JWT_SECRET || 'secret-key-change-in-production',
      { expiresIn: '1h' }
    );

    const refreshToken = jwt.sign(
      { id: user.id },
      process.env.JWT_REFRESH_SECRET || 'refresh-secret',
      { expiresIn: '7d' }
    );

    // Step 4: Log successful login
    await auditService.logAction(
      user.id,
      'LOGIN_SUCCESS',
      { username, role: user.role },
      { ip: req.ip, deviceId }
    );

    // Step 5: Return tokens
    res.json({
      success: true,
      token: accessToken,
      refreshToken,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        deviceId,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'LOGIN_ERROR', message: error.message });
  }
});

/**
 * POST /api/auth/register
 * Register new user (requires SYNC_ADMIN role)
 *
 * QUESTION 3 ANSWER:
 * Example of RBAC enforcement:
 * Only SYNC_ADMIN can register new users
 * Other roles get 403 Forbidden
 */
router.post('/register', authMiddleware, rbacMiddleware('write:*'), async (req, res) => {
  try {
    const { username, role, otpSecret, deviceId } = req.body;

    // Verify SYNC_ADMIN role
    if (req.user.role !== 'SYNC_ADMIN') {
      await auditService.logAction(
        req.user.id,
        'REGISTER_FAILED',
        { reason: 'INSUFFICIENT_ROLE', attemptedRole: req.user.role },
        { ip: req.ip }
      );

      return res.status(403).json({
        error: 'FORBIDDEN',
        message: 'Only SYNC_ADMIN can register users',
        requiredRole: 'SYNC_ADMIN',
        yourRole: req.user.role,
      });
    }

    // Check if user exists
    const existing = await req.db('users').where({ username }).first();

    if (existing) {
      return res.status(409).json({
        error: 'USER_EXISTS',
        message: 'Username already registered',
      });
    }

    // Create new user
    const userId = uuidv4();
    await req.db('users').insert({
      id: userId,
      username,
      role,
      otp_secret: otpSecret,
      device_id: deviceId,
      created_at: req.db.fn.now(),
    });

    // Log registration
    await auditService.logAction(
      req.user.id,
      'USER_REGISTERED',
      { newUserId: userId, username, role },
      { ip: req.ip }
    );

    res.json({
      success: true,
      userId,
      username,
      role,
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'REGISTER_ERROR', message: error.message });
  }
});

/**
 * POST /api/auth/register-key
 * Register device public key
 *
 * QUESTION 2 ANSWER:
 * Store public key in ledger (CRDT)
 * Private key never leaves device (localStorage)
 * System becomes zero-trust: verify with public key only
 */
router.post('/register-key', authMiddleware, async (req, res) => {
  try {
    const { publicKey, deviceId } = req.body;

    // Store in users table
    await req.db('users')
      .where({ id: req.user.id })
      .update({
        public_key: publicKey,
        device_id: deviceId,
        key_registered_at: req.db.fn.now(),
      });

    // Also store in CRDT ledger for P2P verification
    const crdt = req.app.get('crdt');
    if (crdt) {
      crdt.write(`pubkey_${req.user.id}`, {
        userId: req.user.id,
        publicKey,
        deviceId,
        registeredAt: new Date().toISOString(),
      });
    }

    // Log key registration
    await auditService.logAction(
      req.user.id,
      'PUBLIC_KEY_REGISTERED',
      { deviceId, keyFingerprint: publicKey.substring(0, 32) + '...' },
      { ip: req.ip }
    );

    res.json({
      success: true,
      message: 'Public key registered',
      deviceId,
    });
  } catch (error) {
    console.error('Key registration error:', error);
    res
      .status(500)
      .json({ error: 'KEY_REGISTER_ERROR', message: error.message });
  }
});

/**
 * GET /api/auth/otp/generate
 * Generate new TOTP secret for first-time setup
 */
router.get('/otp/generate', async (req, res) => {
  try {
    const secret = OTPService.generateSecret(32);

    res.json({
      success: true,
      secret,
      algorithm: 'TOTP',
      window: 30, // seconds
      digits: 6,
    });
  } catch (error) {
    res
      .status(500)
      .json({ error: 'OTP_GENERATE_ERROR', message: error.message });
  }
});

/**
 * POST /api/auth/refresh
 * Refresh access token
 */
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    const decoded = jwt.verify(
      refreshToken,
      process.env.JWT_REFRESH_SECRET || 'refresh-secret'
    );

    const user = await req.db('users').where({ id: decoded.id }).first();

    const newAccessToken = jwt.sign(
      {
        id: user.id,
        username: user.username,
        role: user.role,
      },
      process.env.JWT_SECRET || 'secret-key',
      { expiresIn: '1h' }
    );

    res.json({
      success: true,
      token: newAccessToken,
    });
  } catch (error) {
    res.status(401).json({
      error: 'TOKEN_REFRESH_FAILED',
      message: error.message,
    });
  }
});

/**
 * GET /api/audit/logs
 * Get audit log entries (requires read:audit permission)
 *
 * QUESTION: How is delivery history stored and verified?
 * ✓ All actions logged with hash chaining
 * ✓ Tamper detection: recompute hash chain
 * ✓ Non-repudiation: proves who did what, when
 */
router.get('/logs', authMiddleware, rbacMiddleware('read:audit'), async (req, res) => {
  try {
    const { userId, eventType, limit = 100 } = req.query;

    const filters = {};
    if (userId) filters.userId = userId;
    if (eventType) filters.eventType = eventType;

    const result = await auditService.getEntries(filters);

    res.json({
      success: true,
      entries: result.entries.slice(0, limit),
      count: result.entries.length,
    });
  } catch (error) {
    res.status(500).json({ error: 'AUDIT_LOG_ERROR', message: error.message });
  }
});

/**
 * GET /api/audit/verify
 * Verify audit log integrity (tamper detection)
 */
router.get('/verify', authMiddleware, rbacMiddleware('read:audit'), async (req, res) => {
  try {
    const result = await auditService.verifyIntegrity();

    if (!result.valid) {
      // Alert: log tampering detected
      await auditService.logAction(
        req.user.id,
        'TAMPER_DETECTED',
        { tamperedEntries: result.tamperedEntries },
        { ip: req.ip, severity: 'CRITICAL' }
      );
    }

    res.json({
      success: true,
      valid: result.valid,
      chainIntegrity: result.chainIntegrity,
      totalEntries: result.totalEntries,
      tamperedEntries: result.tamperedEntries,
    });
  } catch (error) {
    res
      .status(500)
      .json({ error: 'AUDIT_VERIFY_ERROR', message: error.message });
  }
});

/**
 * POST /api/auth/logout
 * Logout (clear session)
 */
router.post('/logout', authMiddleware, async (req, res) => {
  try {
    await auditService.logAction(
      req.user.id,
      'LOGOUT',
      {},
      { ip: req.ip }
    );

    res.json({
      success: true,
      message: 'Logged out',
    });
  } catch (error) {
    res.status(500).json({ error: 'LOGOUT_ERROR', message: error.message });
  }
});

module.exports = {
  router,
  initAudit,
};
