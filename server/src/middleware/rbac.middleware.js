/**
 * RBAC Middleware — Role-Based Access Control
 * Protects routes based on user role
 * 
 * EXAMPLE: Only CAMP_COMMANDER can write:triage_decisions
 */

const { useAuthStore } = require('../store/authStore'); // Assume server has access

/**
 * AUTH MIDDLEWARE — Verify JWT token
 */
const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'UNAUTHORIZED',
      message: 'Missing or invalid authorization header',
    });
  }

  const token = authHeader.substring(7);

  try {
    // Verify JWT (in production use jsonwebtoken library signed with secret)
    const decoded = this._verifyJWT(token);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({
      error: 'TOKEN_INVALID',
      message: 'Invalid or expired token',
    });
  }
};

/**
 * RBAC MIDDLEWARE — Check if user has required permission
 *
 * Usage: app.post('/api/triage/evaluate', rbacMiddleware('write:triage_decisions'), handler)
 *
 * EXAMPLE RESTRICTION:
 * Only CAMP_COMMANDER can write:triage_decisions
 * Field Volunteer attempts to call → 403 Forbidden
 */
const rbacMiddleware = (requiredPermission) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'NOT_AUTHENTICATED',
        message: 'User not authenticated',
      });
    }

    // Check if user has permission
    const userRole = req.user.role;
    const permissions = getPermissionsForRole(userRole);

    // Check exact match
    if (permissions.includes(requiredPermission)) {
      return next();
    }

    // Check wildcard
    if (requiredPermission.startsWith('write:') && permissions.includes('write:*')) {
      return next();
    }

    if (requiredPermission.startsWith('read:') && permissions.includes('read:*')) {
      return next();
    }

    // Permission denied
    return res.status(403).json({
      error: 'FORBIDDEN',
      message: `Permission denied. Required: ${requiredPermission}`,
      userRole,
      userPermissions: permissions,
    });
  };
};

/**
 * Helper: Get permissions for role
 */
function getPermissionsForRole(role) {
  const permissions = {
    FIELD_VOLUNTEER: ['read:deliveries', 'write:delivery_status', 'read:routes'],

    SUPPLY_MANAGER: [
      'read:deliveries',
      'write:deliveries',
      'read:inventory',
      'write:inventory',
      'read:routes',
    ],

    DRONE_OPERATOR: [
      'read:deliveries',
      'write:delivery_status',
      'read:routes',
      'write:drone_routes',
      'read:fleet',
      'write:drone_telemetry',
    ],

    CAMP_COMMANDER: [
      'read:deliveries',
      'write:deliveries',
      'read:inventory',
      'write:inventory',
      'read:routes',
      'write:routes',
      'read:fleet',
      'write:fleet',
      'write:triage_decisions', // ← Can authorize autonomous preemption
      'write:network_override', // ← Can trigger chaos for demo
      'read:audit',
    ],

    SYNC_ADMIN: [
      'read:*', // Read everything
      'write:*', // Write everything
      'write:conflict_resolution',
      'write:crdt_reset',
      'read:audit',
    ],
  };

  return permissions[role] || [];
}

/**
 * Helper: Verify JWT (placeholder - use jsonwebtoken in production)
 */
function _verifyJWT(token) {
  // In production:
  // const decoded = jwt.verify(token, process.env.JWT_SECRET);
  // return decoded;

  // Simplified for demo:
  try {
    const parts = token.split('.');
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    return payload;
  } catch (e) {
    throw new Error('Invalid JWT');
  }
}

module.exports = {
  authMiddleware,
  rbacMiddleware,
  getPermissionsForRole,
};
