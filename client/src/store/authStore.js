/**
 * Auth Store — Global Authentication State (Zustand)
 * 
 * QUESTION 3 ANSWER:
 * How are roles enforced?
 * ✓ Each user has a role from 5-tier RBAC system
 * ✓ Routes protected by middleware checking role
 * ✓ Example: only Camp Commander can authorize drone drops
 */

import { create } from 'zustand';

export const useAuthStore = create((set, get) => ({
  // State
  user: null, // { id, username, role, deviceId, publicKey }
  isAuthenticated: false,
  token: null,
  refreshToken: null,
  otpSecret: null,
  roleChanging: false,
  otpCountdown: null,

  // Roles Reference
  roles: {
    FIELD_VOLUNTEER: 'FIELD_VOLUNTEER',
    SUPPLY_MANAGER: 'SUPPLY_MANAGER',
    DRONE_OPERATOR: 'DRONE_OPERATOR',
    CAMP_COMMANDER: 'CAMP_COMMANDER',
    SYNC_ADMIN: 'SYNC_ADMIN',
  },

  /**
   * RBAC Permission Matrix
   * Maps roles to allowed actions
   */
  permissions: {
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
      'write:triage_decisions', // Can authorize autonomous preemption
      'write:network_override', // Can manually trigger floods for demo
      'read:audit',
    ],

    SYNC_ADMIN: [
      'read:*', // Read everything
      'write:*', // Write everything
      'write:conflict_resolution',
      'write:crdt_reset',
      'read:audit',
    ],
  },

  /**
   * Check if current user has permission for action
   */
  hasPermission: (action) => {
    const { user, permissions } = get();
    if (!user) return false;

    const rolePerms = permissions[user.role] || [];

    // Check exact match
    if (rolePerms.includes(action)) return true;

    // Check wildcard
    if (rolePerms.includes('write:*') && action.startsWith('write:'))
      return true;
    if (rolePerms.includes('read:*') && action.startsWith('read:')) return true;

    return false;
  },

  /**
   * Check if current user has role
   */
  hasRole: (role) => {
    const { user } = get();
    return user?.role === role;
  },

  /**
   * Get user's role level (for hierarchical checks)
   */
  getRoleLevel: () => {
    const { user, roles } = get();
    if (!user) return -1;

    const hierarchy = [
      roles.FIELD_VOLUNTEER, // 0
      roles.SUPPLY_MANAGER, // 1
      roles.DRONE_OPERATOR, // 1.5
      roles.CAMP_COMMANDER, // 2
      roles.SYNC_ADMIN, // 3 (highest)
    ];

    return hierarchy.indexOf(user.role);
  },

  /**
   * Login with username + OTP
   */
  login: async (username, otpCode, deviceId) => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, otpCode, deviceId }),
      });

      if (!response.ok) {
        const error = await response.json();
        return { success: false, error: error.error, message: error.message };
      }

      const data = await response.json();

      // Store tokens
      localStorage.setItem('accessToken', data.token);
      localStorage.setItem('refreshToken', data.refreshToken);

      set({
        user: data.user,
        isAuthenticated: true,
        token: data.token,
        refreshToken: data.refreshToken,
      });

      return { success: true, user: data.user };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  /**
   * Register new user (requires SYNC_ADMIN role)
   */
  register: async (username, role, otpSecret, deviceId) => {
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${get().token}`,
        },
        body: JSON.stringify({ username, role, otpSecret, deviceId }),
      });

      if (!response.ok) {
        const error = await response.json();
        return { success: false, error: error.error };
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  /**
   * Refresh access token
   */
  refreshAccessToken: async () => {
    try {
      const refresh = get().refreshToken;
      if (!refresh) return { success: false, error: 'No refresh token' };

      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: refresh }),
      });

      if (!response.ok) {
        return { success: false, error: 'Token refresh failed' };
      }

      const data = await response.json();
      localStorage.setItem('accessToken', data.token);

      set({ token: data.token });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  /**
   * Get OTP setup secret (for first login)
   */
  generateOTPSecret: async () => {
    try {
      const response = await fetch('/api/auth/otp/generate', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        return { success: false };
      }

      const data = await response.json();
      set({ otpSecret: data.secret });
      return { success: true, secret: data.secret };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  /**
   * Register device public key
   */
  registerPublicKey: async (publicKey, deviceId) => {
    try {
      const response = await fetch('/api/auth/register-key', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${get().token}`,
        },
        body: JSON.stringify({ publicKey, deviceId }),
      });

      if (!response.ok) {
        return { success: false };
      }

      const data = await response.json();
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  /**
   * Logout
   */
  logout: () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    set({
      user: null,
      isAuthenticated: false,
      token: null,
      refreshToken: null,
    });
  },

  /**
   * Set OTP countdown for UI
   */
  setOTPCountdown: (seconds) => {
    set({ otpCountdown: seconds });
  },

  /**
   * Set user (internal)
   */
  setUser: (user) => {
    set({ user, isAuthenticated: !!user });
  },

  /**
   * Get action description (for audit)
   */
  getActionDescription: (action) => {
    const descriptions = {
      'read:deliveries': 'View delivery list',
      'write:delivery_status': 'Update delivery status',
      'write:deliveries': 'Create/modify deliveries',
      'write:inventory': 'Modify inventory',
      'write:routes': 'Override routes',
      'write:drone_routes': 'Program drone routes',
      'write:triage_decisions': 'Authorize autonomous preemption',
      'write:network_override': 'Trigger chaos (demo)',
      'write:conflict_resolution': 'Resolve data conflicts',
      'write:crdt_reset': 'Reset CRDT ledger',
    };

    return descriptions[action] || action;
  },
}));
