import { create } from 'zustand';
import api from '../services/api';

export const useUserStore = create((set, get) => ({
  registry: [],
  isLoading: false,
  error: null,
  lastFetched: null,

  fetchRegistry: async () => {
    // Cache for 5 minutes
    if (get().lastFetched && Date.now() - get().lastFetched < 300000) {
      return;
    }

    set({ isLoading: true });
    try {
      const response = await api.get('/api/auth/registry');
      set({ 
        registry: response.data.registry, 
        isLoading: false,
        lastFetched: Date.now()
      });
    } catch (err) {
      set({ error: err.message, isLoading: false });
    }
  },

  getPublicKey: (username) => {
    const user = get().registry.find(u => u.username === username);
    return user ? user.public_key : null;
  }
}));

export default useUserStore;
