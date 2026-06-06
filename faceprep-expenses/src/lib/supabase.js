import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isMisconfigured = !supabaseUrl || !supabaseAnonKey

export const supabase = isMisconfigured
  ? null
  : createClient(supabaseUrl, supabaseAnonKey)

export const ALLOWED_DOMAIN = 'faceprep.in'

export async function signInWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin,
      queryParams: { hd: ALLOWED_DOMAIN },
    },
  })
  if (error) throw error
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export function isDomainAllowed(email) {
  return email?.endsWith(`@${ALLOWED_DOMAIN}`)
}
