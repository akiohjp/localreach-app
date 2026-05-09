'use client'

import { useState, useRef, useCallback } from 'react'
import { Upload, X, CheckCircle, Loader2, ImageIcon } from 'lucide-react'
import {
  uploadStoreLogo,
  updateStoreLogo,
  createStoreLogoSignedUrl,
} from '@/utils/supabase/storage'

const MAX_BYTES = 2 * 1024 * 1024 // 2 MB
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

type UploadState = 'idle' | 'uploading' | 'success' | 'error'

type Props = {
  storeId: string
  currentLogoUrl: string | null
  onSuccess?: (newUrl: string) => void
}

export default function LogoUploader({ storeId, currentLogoUrl, onSuccess }: Props) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentLogoUrl)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [state, setState] = useState<UploadState>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const validate = useCallback((file: File): string | null => {
    if (!ACCEPTED.includes(file.type)) return 'PNG, JPG, WebP, GIF only.'
    if (file.size > MAX_BYTES) return 'Image must be smaller than 2 MB.'
    return null
  }, [])

  function applyFile(file: File) {
    const err = validate(file)
    if (err) { setErrorMsg(err); return }

    setErrorMsg('')
    setState('idle')
    setPendingFile(file)

    const objectUrl = URL.createObjectURL(file)
    setPreviewUrl((prev) => {
      if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev)
      return objectUrl
    })
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) applyFile(file)
    // Reset so the same file can be re-selected after cancel
    e.target.value = ''
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(true)
  }

  function handleDragLeave() { setIsDragging(false) }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) applyFile(file)
  }

  function handleCancel() {
    if (previewUrl?.startsWith('blob:')) URL.revokeObjectURL(previewUrl)
    setPendingFile(null)
    setPreviewUrl(currentLogoUrl)
    setState('idle')
    setErrorMsg('')
  }

  async function handleUpload() {
    if (!pendingFile) return

    setState('uploading')
    setErrorMsg('')

    try {
      const path = await uploadStoreLogo(storeId, pendingFile)
      await updateStoreLogo(storeId, path)
      const signed = await createStoreLogoSignedUrl(path)

      // Revoke the blob URL now that the real URL is available
      if (previewUrl?.startsWith('blob:')) URL.revokeObjectURL(previewUrl)

      setPreviewUrl(signed)
      setPendingFile(null)
      setState('success')
      onSuccess?.(path)
    } catch (err) {
      setState('error')
      setErrorMsg(err instanceof Error ? err.message : 'Upload failed. Please try again.')
    }
  }

  const isUploading = state === 'uploading'
  const hasPending = pendingFile !== null && state !== 'success'

  return (
    <div className="space-y-3 w-full">

      {/* ── Drop zone ───────────────────────────────────── */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload logo — click or drag an image here"
        onClick={() => !isUploading && inputRef.current?.click()}
        onKeyDown={(e) => e.key === 'Enter' && !isUploading && inputRef.current?.click()}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={[
          'relative flex flex-col items-center justify-center gap-3',
          'rounded-2xl border-2 border-dashed p-8 text-center',
          'transition-colors duration-150 outline-none',
          isUploading
            ? 'cursor-not-allowed opacity-60 border-gray-200 bg-gray-50'
            : isDragging
            ? 'border-slate-500 bg-slate-50 cursor-copy'
            : 'border-gray-300 bg-gray-50 hover:border-slate-400 hover:bg-white cursor-pointer',
        ].join(' ')}
      >
        {previewUrl ? (
          <img
            src={previewUrl}
            alt="Store logo preview"
            className="h-24 w-auto max-w-[16rem] rounded-xl object-contain"
          />
        ) : (
          <>
            <div className="rounded-xl bg-slate-100 p-3">
              <ImageIcon size={24} className="text-slate-400" strokeWidth={1.5} />
            </div>
            <div className="space-y-0.5">
              <p className="text-sm font-semibold text-slate-700">
                Click to select or drag &amp; drop
              </p>
              <p className="text-xs text-slate-400">PNG · JPG · WebP · max 2 MB</p>
            </div>
          </>
        )}

        {/* Drag overlay label */}
        {isDragging && (
          <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-slate-900/10 backdrop-blur-[1px]">
            <p className="text-sm font-bold text-slate-700">Drop to preview</p>
          </div>
        )}

        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED.join(',')}
          className="sr-only"
          onChange={handleInputChange}
          disabled={isUploading}
        />
      </div>

      {/* ── Error message ────────────────────────────────── */}
      {errorMsg && (
        <p className="flex items-center gap-1.5 text-xs text-red-500">
          <X size={12} className="shrink-0" />
          {errorMsg}
        </p>
      )}

      {/* ── Action buttons (visible while a new file is pending) ── */}
      {hasPending && (
        <div className="flex gap-2">
          <button
            onClick={handleUpload}
            disabled={isUploading}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl
              bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm
              hover:bg-slate-800 active:scale-[0.98] transition-all
              disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isUploading ? (
              <><Loader2 size={14} className="animate-spin" />Uploading…</>
            ) : (
              <><Upload size={14} />Upload Logo</>
            )}
          </button>

          <button
            onClick={handleCancel}
            disabled={isUploading}
            aria-label="Cancel"
            className="rounded-xl border border-gray-300 bg-white px-3 py-2.5
              text-slate-500 hover:bg-gray-50 active:scale-[0.98] transition-all
              disabled:cursor-not-allowed disabled:opacity-60"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* ── Success banner ───────────────────────────────── */}
      {state === 'success' && (
        <div className="flex items-center gap-2 rounded-xl border border-green-200
          bg-green-50 px-4 py-2.5"
        >
          <CheckCircle size={14} className="shrink-0 text-green-500" />
          <p className="text-xs font-semibold text-green-700">
            Logo updated successfully!
          </p>
        </div>
      )}
    </div>
  )
}
