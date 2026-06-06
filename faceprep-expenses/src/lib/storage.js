import { supabase } from './supabase'

export async function uploadBill(file, path) {
  const { data, error } = await supabase.storage
    .from('bills')
    .upload(path, file, { upsert: true })
  if (error) throw error
  return data.path
}

export async function getBillUrl(path) {
  const { data } = await supabase.storage
    .from('bills')
    .createSignedUrl(path, 3600) // 1 hour expiry
  return data?.signedUrl
}
