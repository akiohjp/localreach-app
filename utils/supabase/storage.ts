import { createClient } from '@/utils/supabase/client'

const BUCKET = 'store-logos'

/**
 * Uploads an image file to the store-logos bucket and returns its public URL.
 *
 * Storage path: {userId}/store_{storeId}_{timestamp}.{ext}
 * - The userId prefix satisfies the RLS policy (foldername[1] = auth.uid()).
 * - The timestamp suffix makes every upload unique so filenames never collide.
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

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return data.publicUrl
}

/**
 * Updates stores.logo_url in the database.
 * Separated from the upload so callers can update without re-uploading.
 */
export async function updateStoreLogo(
  storeId: string,
  publicUrl: string,
): Promise<void> {
  const supabase = createClient()

  const { error } = await supabase
    .from('stores')
    .update({ logo_url: publicUrl })
    .eq('id', storeId)

  if (error) throw error
}
