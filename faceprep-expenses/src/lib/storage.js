import { supabase } from './supabase'
import imageCompression from 'browser-image-compression'

/**
 * Compress an image bill before upload.
 * - PDFs pass through untouched (already compact)
 * - Images are downscaled to max 1500px and compressed to ~0.3MB target
 * A 3MB phone photo typically becomes 150-300KB — a ~10x saving — while
 * staying perfectly legible for a bill/receipt.
 */
async function optimiseFile(file) {
  // Only compress images; leave PDFs and other types alone
  if (!file.type.startsWith('image/')) return file

  try {
    const compressed = await imageCompression(file, {
      maxSizeMB: 0.3,            // aim for ~300KB
      maxWidthOrHeight: 1500,    // plenty for a readable bill
      useWebWorker: true,
      fileType: 'image/webp',    // WebP — ~30% smaller than JPEG
      initialQuality: 0.7,
    })
    // Preserve a sensible filename with .webp extension
    const newName = file.name.replace(/\.(jpe?g|png|gif|bmp|heic|heif)$/i, '.webp')
    return new File([compressed], newName, { type: 'image/webp' })
  } catch (e) {
    // If compression fails for any reason, fall back to the original
    console.warn('Image compression failed, uploading original:', e)
    return file
  }
}

export async function uploadBill(file, path) {
  const optimised = await optimiseFile(file)
  // If we changed the extension to .webp, reflect that in the storage path
  const finalPath = optimised.name.endsWith('.webp')
    ? path.replace(/\.(jpe?g|png|gif|bmp|heic|heif)$/i, '.webp')
    : path

  const { data, error } = await supabase.storage
    .from('bills')
    .upload(finalPath, optimised, { upsert: true })
  if (error) throw error
  return data.path
}

export async function getBillUrl(path) {
  const { data } = await supabase.storage
    .from('bills')
    .createSignedUrl(path, 3600) // 1 hour expiry
  return data?.signedUrl
}
