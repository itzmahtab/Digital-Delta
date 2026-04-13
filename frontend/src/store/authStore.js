import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '../services/api';

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      login: async (username, otp, role, otpSecret, demoBypass = false) => {
        set({ isLoading: true, error: null });
        
        try {
          const response = await api.post('/api/auth/login', { 
            username, 
            otp,
            role,
            otpSecret,
            demoBypass, // Emergency demo bypass for testing
            deviceId: 'web-' + Math.random().toString(36).substr(2, 9)
          });
          
          const { token, user, newSecret } = response.data;
          
          set({
            user,
            token,
            isAuthenticated: true,
            isLoading: false,
          });
          
          if (token) {
            api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
          }
          
          return { success: true, newSecret };
        } catch (error) {
          const message = error.response?.data?.message || error.message || 'Login failed';
          set({ error: message, isLoading: false });
          return { success: false, error: message };
        }
      },

      checkUser: async (username) => {
        try {
          const response = await api.get(`/api/auth/check/${username}`);
          return response.data;
        } catch (error) {
          return { exists: false };
        }
      },

      setUserRole: (role) => {
        const { user, token } = get();
        set({
          user: { ...user, role },
        });
      },

      logout: () => {
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          error: null,
        });
        delete api.defaults.headers.common['Authorization'];
        localStorage.removeItem('mockUser');
      },

      register: async (userData) => {
        set({ isLoading: true, error: null });
        try {
          const response = await api.post('/api/auth/register', userData);
          set({ isLoading: false });
          return { success: true, data: response.data };
        } catch (error) {
          const message = error.response?.data?.message || 'Registration failed';
          set({ error: message, isLoading: false });
          return { success: false, error: message };
        }
      },

      registerDeviceKey: async (publicKey) => {
        const { token } = get();
        if (!token) return { success: false, error: 'Not authenticated' };
        
        try {
          await api.post('/api/auth/register-key', { publicKey });
          return { success: true };
        } catch (error) {
          return { success: false, error: error.message };
        }
      },

      refreshToken: async () => {
        const { token } = get();
        if (!token) return { success: false };
        
        try {
          const response = await api.post('/api/auth/refresh', {}, {
            headers: { Authorization: `Bearer ${token}` }
          });
          const newToken = response.data.token;
          set({ token: newToken });
          api.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
          return { success: true };
        } catch (error) {
          get().logout();
          return { success: false };
        }
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'digital-delta-auth',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

export default useAuthStore;
