import { createContext, useContext, useEffect, useState } from 'react'
import { supabase, isDomainAllowed, signOut } from '../lib/supabase'
import { useImpersonate } from './useImpersonate'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [domainError, setDomainError] = useState(false)
  const { impersonatedRole } = useImpersonate()

  async function fetchProfile(userId) {
    const { data } = await supabase
      .from('profiles').select('*').eq('id', userId).single()
    setProfile(data)
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const u = session?.user ?? null
      if (u && !isDomainAllowed(u.email)) {
        setDomainError(true); signOut(); setLoading(false); return
      }
      setUser(u)
      if (u) fetchProfile(u.id)
      setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null
      if (u && !isDomainAllowed(u.email)) {
        setDomainError(true); signOut(); return
      }
      setDomainError(false)
      setUser(u)
      if (u) fetchProfile(u.id)
      else setProfile(null)
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  // Effective profile: if admin is impersonating, override the role
  const effectiveProfile = profile
    ? (impersonatedRole && profile.role === 'admin'
        ? { ...profile, role: impersonatedRole, _impersonating: true }
        : profile)
    : null

  return (
    <AuthContext.Provider value={{ user, profile: effectiveProfile, realProfile: profile, loading, domainError, refetchProfile: () => fetchProfile(user?.id) }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
