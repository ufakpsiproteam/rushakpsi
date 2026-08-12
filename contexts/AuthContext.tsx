'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { UserProfile, getCurrentUserProfile, signIn as authSignIn, signOut as authSignOut, signUp as authSignUp, AccessLevel, AccountType, getBrotherRoles } from '@/lib/auth'

interface AuthContextType {
  user: User | null
  profile: UserProfile | null
  loading: boolean
  roles: string[]
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, name: string, accountType: AccountType, accessLevel?: AccessLevel, additionalData?: any) => Promise<void>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
  hasRole: (role: string) => boolean
  refreshRoles: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [roles, setRoles] = useState<string[]>([])

  useEffect(() => {
    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        loadProfile()
      } else {
        setLoading(false)
      }
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        loadProfile()
      } else {
        setProfile(null)
        setRoles([])
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  // Load roles when profile changes (only for brothers)
  useEffect(() => {
    if (profile?.id && profile?.account_type === 'brother') {
      loadRoles()
    } else {
      setRoles([])
    }
  }, [profile])

  async function loadProfile() {
    try {
      const userProfile = await getCurrentUserProfile()
      setProfile(userProfile)
    } catch (error: any) {
      console.error('Error loading profile:', error)
      console.error('Error details:', error.message, error.details, error.hint)
      setProfile(null)
    } finally {
      setLoading(false)
    }
  }

  async function loadRoles() {
    if (!profile?.id) return
    try {
      const brotherRoles = await getBrotherRoles(profile.id)
      setRoles(brotherRoles)
    } catch (error) {
      console.error('Error loading roles:', error)
      setRoles([])
    }
  }

  async function refreshRoles() {
    await loadRoles()
  }

  function hasRole(role: string): boolean {
    return roles.includes(role)
  }

  async function signIn(email: string, password: string) {
    const data = await authSignIn(email, password)
    setUser(data.user)
    await loadProfile()
  }

  async function signUp(
    email: string,
    password: string,
    name: string,
    accountType: AccountType,
    accessLevel: AccessLevel = 'basic',
    additionalData?: any
  ) {
    const data = await authSignUp(email, password, name, accountType, accessLevel, additionalData)
    setUser(data.user)
    await loadProfile()
  }

  async function signOut() {
    await authSignOut()
    setUser(null)
    setProfile(null)
  }

  async function refreshProfile() {
    await loadProfile()
  }

  const value = {
    user,
    profile,
    loading,
    roles,
    signIn,
    signUp,
    signOut,
    refreshProfile,
    hasRole,
    refreshRoles,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
