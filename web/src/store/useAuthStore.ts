import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'RIDER' | 'DRIVER';
}

interface AuthState {
  user: User | null;
  token: string | null;
  isDemo: boolean;
  setAuth: (user: User, token: string) => void;
  setDemo: (isDemo: boolean) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isDemo: false,
      setAuth: (user: User, token: string) => set({ user, token, isDemo: false }),
      setDemo: (isDemo: boolean) => set({ 
        isDemo, 
        user: isDemo ? { id: 'demo-user', name: 'Demo Rider', email: 'demo@eride.com', role: 'RIDER' } : null 
      }),
      logout: () => set({ user: null, token: null, isDemo: false }),
    }),
    {
      name: 'eride-auth',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
