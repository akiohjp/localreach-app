import { createClient } from '@/utils/supabase/client'

const BUCKET = 'store-logos'

/**
 * Uploads store-logos bucket object — returns bucket-relative path (uuid/filename...).
 *
 * Preview URLs come from signed URLs ({@link createStoreLogoSignedUrl}).
 */
export async function uploadStoreLogo(
  storeId: string,
  file: File,
): Promise<string> {
  const supabase = createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) throw new Error('Not authenticated')

  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
  const filename = `store_${storeId}_${Date.now()}.${ext}`
  const path = `${user.id}/${filename}`

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type })

  if (uploadError) throw uploadError
  return path
}

/** Readable URL for authenticated owner (bucket is private — no public CDN read). */
export async function createStoreLogoSignedUrl(
  bucketPath: string,
  expiresSeconds = 3600,
): Promise<string> {
  const supabase = createClient()
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(bucketPath, expiresSeconds)

  if (error || !data?.signedUrl) throw error ?? new Error('Could not create logo URL')
  return data.signedUrl
}

/**
 * Updates stores.logo_url in the database.
 * Separated from the upload so callers can update without re-uploading.
 */
export async function updateStoreLogo(
  storeId: string,
  bucketPathOrLegacyUrl: string,
): Promise<void> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('stores')
    .update({ logo_url: bucketPathOrLegacyUrl })
    .eq('id', storeId)
    .select('id')

  if (error) throw error
  // A 0-row update means RLS silently blocked the write (or the row is gone):
  // Postgres accepts the statement but changes nothing. Without .select() this
  // resolves successfully and the UI shows a false "success". Fail loudly instead.
  if (!data || data.length === 0) {
    throw new Error('Logo update did not persist — you may not have permission to edit this store.')
  }
}
