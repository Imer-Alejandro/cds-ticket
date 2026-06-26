import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface User {
  id: string;
  nombre: string;
  apellido?: string;
  correo: string;
  rolId: string;
  rolNombre: string;
  permisos: Record<string, unknown>;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (userData: User, token?: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      login: (userData, token) => set({ user: userData, token: token || null, isAuthenticated: true }),
      logout: () => set({ user: null, token: null, isAuthenticated: false }),
    }),
    {
      name: 'auth-storage',
    }
  )
)
