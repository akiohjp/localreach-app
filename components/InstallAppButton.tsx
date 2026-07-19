'use client'

/**
 * "Install app" affordance for the STORE OWNER.
 *
 * The app has been an installable PWA for a while (manifest + service worker +
 * maskable icons), but nothing ever told the owner that — so nobody installed
 * it. This surfaces it where the installer actually is (the dashboard), and
 * handles the two platforms differently:
 *
 *  - Android/Chrome/Edge: capture `beforeinstallprompt` and trigger the native
 *    install dialog on click.
 *  - iOS Safari: NEVER fires `beforeinstallprompt` — installing is a manual
 *    Share -> "Add to Home Screen". Without instructions iOS owners simply
 *    can't install, so we show the steps instead of a dead button. The label
 *    and icon say "Add to Home Screen" there, NOT a download arrow: an owner
 *    who taps a ⬇ icon expects a file to download and reads "nothing happened"
 *    as broken (real owner feedback 2026-07-19).
 *
 * The help sheet is rendered through a PORTAL to document.body on purpose: the
 * dashboard header uses `backdrop-blur`, and backdrop-filter makes an element a
 * containing block for `position: fixed` descendants — rendering the sheet in
 * place squashed it into the header strip instead of covering the screen.
 *
 * Renders nothing when already installed (standalone display mode), and nothing
 * on desktop browsers that offer no install path.
 *
 * Deliberately NOT shown on the guest review page: a guest scans a QR once and
 * leaves — prompting them would only add friction to the money path.
 */

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Download, Share, Plus, X, SquarePlus } from 'lucide-react'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    // iOS Safari uses a non-standard flag
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

function isIos(): boolean {
  if (typeof navigator === 'undefined') return false
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}

/** Real Safari on iOS — Chrome/Firefox/Edge/Opera for iOS cannot add to Home Screen. */
function isIosSafari(): boolean {
  if (!isIos()) return false
  return !/crios|fxios|edgios|opios|mercury/i.test(navigator.userAgent)
}

export default function InstallAppButton() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(true) // assume installed until mounted (avoids flash)
  const [showIosHelp, setShowIosHelp] = useState(false)
  const [ios, setIos] = useState(false)
  const [iosSafari, setIosSafari] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    setInstalled(isStandalone())
    setIos(isIos())
    setIosSafari(isIosSafari())

    function onBeforeInstall(e: Event) {
      // Keep the event so the install dialog can be opened from our own button
      // (browsers only allow it inside a user gesture).
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
    }
    function onInstalled() {
      setInstalled(true)
      setDeferred(null)
      setShowIosHelp(false)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  // Close the sheet on Escape.
  useEffect(() => {
    if (!showIosHelp) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setShowIosHelp(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [showIosHelp])

  async function handleClick() {
    if (ios) {
      setShowIosHelp(true)
      return
    }
    if (!deferred) return
    await deferred.prompt()
    await deferred.userChoice
    setDeferred(null)
  }

  // Already an app, or a browser with no install path → show nothing.
  if (installed) return null
  if (!deferred && !ios) return null

  const sheet = showIosHelp ? (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-900/50 px-4 pb-6 sm:items-center sm:pb-0"
      role="dialog"
      aria-modal="true"
      aria-label="Add to Home Screen"
      onClick={() => setShowIosHelp(false)}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-sm font-bold text-slate-900">Add LocalReach to your Home Screen</h2>
          <button
            type="button"
            onClick={() => setShowIosHelp(false)}
            aria-label="Close"
            className="-mt-1 -mr-1 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X size={16} />
          </button>
        </div>

        <p className="mt-2 text-xs leading-relaxed text-slate-500">
          Nothing downloads. iPhone adds it as an app icon, straight to your dashboard.
        </p>

        {!iosSafari && (
          <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            This only works in <span className="font-semibold">Safari</span>. Open this page in
            Safari first, then try again.
          </div>
        )}

        <ol className="mt-4 space-y-3 text-sm text-slate-700">
          <li className="flex items-start gap-2.5">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">1</span>
            <span className="flex flex-wrap items-center gap-1.5">
              Tap the Share button
              <Share size={15} className="text-sky-600" />
              at the <span className="font-semibold">bottom</span> of Safari
            </span>
          </li>
          <li className="flex items-start gap-2.5">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">2</span>
            <span className="flex flex-wrap items-center gap-1.5">
              Scroll down, tap
              <Plus size={15} className="text-slate-700" />
              <span className="font-semibold">Add to Home Screen</span>
            </span>
          </li>
          <li className="flex items-start gap-2.5">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">3</span>
            <span>
              Tap <span className="font-semibold">Add</span> — the icon appears on your Home Screen
            </span>
          </li>
        </ol>

        <button
          type="button"
          onClick={() => setShowIosHelp(false)}
          className="mt-5 w-full rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white
            hover:bg-slate-800 active:scale-[0.99] transition-all"
        >
          Got it
        </button>
      </div>
    </div>
  ) : null

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className="flex items-center gap-1.5 rounded-lg border border-amber-300
          bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800
          hover:border-amber-400 hover:bg-amber-100 transition-all"
      >
        {ios ? <SquarePlus size={12} /> : <Download size={12} />}
        <span className="hidden sm:inline">{ios ? 'Add to Home Screen' : 'Install app'}</span>
        <span className="sm:hidden">{ios ? 'Add' : 'App'}</span>
      </button>

      {mounted && sheet ? createPortal(sheet, document.body) : null}
    </>
  )
}
