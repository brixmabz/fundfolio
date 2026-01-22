import { create } from 'zustand'
import {
  validateCredentials,
  createSession,
  validateSession,
  logout as logoutService,
  refreshSession,
} from '@/services/auth'

interface User {
  id: number
  username: string
}

interface AuthState {
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
  user: User | null
  login: (username: string, password: string) => Promise<boolean>
  checkAuth: () => void
  logout: () => void
  clearError: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: false,
  isLoading: true,
  error: null,
  user: null,

  login: async (username: string, password: string) => {
    set({ isLoading: true, error: null })

    try {
      const isValid = await validateCredentials(username, password)

      if (isValid) {
        createSession()
        // For now, use a default user ID of 1 (single-user app)
        set({ isAuthenticated: true, isLoading: false, user: { id: 1, username } })
        return true
      }

      set({ error: 'Invalid username or password', isLoading: false })
      return false
    } catch (error) {
      set({
        error: 'An error occurred during login',
        isLoading: false,
      })
      return false
    }
  },

  checkAuth: () => {
    const isValid = validateSession()
    if (isValid) {
      refreshSession()
      // Restore user on session refresh (single-user app, ID=1)
      set({ isAuthenticated: true, isLoading: false, user: { id: 1, username: 'admin' } })
    } else {
      set({ isAuthenticated: false, isLoading: false, user: null })
    }
  },

  logout: () => {
    logoutService()
    set({ isAuthenticated: false, error: null, user: null })
  },

  clearError: () => {
    set({ error: null })
  },
}))
