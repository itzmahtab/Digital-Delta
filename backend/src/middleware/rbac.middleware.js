import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'digital-delta-secret-key-2026';

/**
 * RBAC Role Hierarchy (highest to lowest):
 * SYNC_ADMIN > CAMP_COMMANDER > DRONE_OPERATOR > SUPPLY_MANAGER > FIELD_VOLUNTEER
 */
const roleHierarchy = {
  'admin': 5,
  'commander': 4,
  'drone_operator': 3,
  'manager': 2,
  'volunteer': 1
};

/**
 * Permissions map: role => allowed actions
 */
const permissionMap = {
  'admin': ['*'], // Full access
  'commander': ['view_deliveries', 'view_fleet', 'view_network', 'create_triage', 'evaluate_triage', 'start_sync', 'view_audit'],
  'drone_operator': ['view_deliveries', 'view_fleet', 'update_fleet_status', 'view_network', 'view_sync'],
  'manager': ['view_deliveries', 'create_delivery', 'update_delivery', 'view_inventory', 'manage_inventory', 'view_sync'],
  'volunteer': ['view_deliveries', 'view_inventory', 'view_sync']
};

/**
 * Authenticate token from Authorization header
 */
export function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      error: 'UNAUTHORIZED',
      message: 'Access token required'
    });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: 'Invalid or expired token'
      });
    }
    req.user = user;
    next();
  });
}

/**
 * Check if user has minimum required role (by hierarchy)
 */
export function requireRole(...requiredRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'User not authenticated'
      });
    }

    const userRoleLevel = roleHierarchy[req.user.role] || 0;
    const hasRequiredRole = requiredRoles.some(role => {
      const requiredLevel = roleHierarchy[role] || 0;
      return userRoleLevel >= requiredLevel;
    });

    if (!hasRequiredRole) {
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: `Insufficient permissions. Required role: ${requiredRoles.join(' or ')}. Your role: ${req.user.role}`
      });
    }

    next();
  };
}

/**
 * Check if user has specific permission
 */
export function requirePermission(...actions) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'User not authenticated'
      });
    }

    const userPermissions = permissionMap[req.user.role] || [];
    const hasFullAccess = userPermissions.includes('*');
    const hasPermission = actions.some(action => userPermissions.includes(action));

    if (!hasFullAccess && !hasPermission) {
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: `You don't have permission to perform: ${actions.join(', ')}`
      });
    }

    next();
  };
}

/**
 * Check if user is admin
 */
export function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      error: 'UNAUTHORIZED',
      message: 'User not authenticated'
    });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({
      error: 'FORBIDDEN',
      message: 'Admin access required'
    });
  }

  next();
}

export default {
  authenticateToken,
  requireRole,
  requirePermission,
  requireAdmin
};
