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
  isAuthenticated: boolean;
  login: (userData: User) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      login: (userData) => set({ user: userData, isAuthenticated: true }),
      logout: () => set({ user: null, isAuthenticated: false }),
    }),
    {
      name: 'auth-storage',
    }
  )
)
