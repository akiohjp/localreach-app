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
 *    can't install, so we show the steps instead of a dead button.
 *
 * Renders nothing when already installed (standalone display mode), and nothing
 * on desktop browsers that offer no install path.
 *
 * Deliberately NOT shown on the guest review page: a guest scans a QR once and
 * leaves — prompting them would only add friction to the money path.
 */

import { useEffect, useState } from 'react'
import { Download, Share, Plus, X } from 'lucide-react'

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

export default function InstallAppButton() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(true) // assume installed until mounted (avoids flash)
  const [showIosHelp, setShowIosHelp] = useState(false)
  const [ios, setIos] = useState(false)

  useEffect(() => {
    setInstalled(isStandalone())
    setIos(isIos())

    function onBeforeInstall(e: Event) {
      // Keep the event so the install dialog can be opened from our own button
      // (browsers only allow it inside a user gesture).
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
    }
    function onInstalled() {
      setInstalled(true)
      setDeferred(null)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  async function handleInstall() {
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

  return (
    <>
      <button
        type="button"
        onClick={handleInstall}
        className="flex items-center gap-1.5 rounded-lg border border-amber-300
          bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800
          hover:border-amber-400 hover:bg-amber-100 transition-all"
      >
        <Download size={12} />
        <span className="hidden sm:inline">Install app</span>
        <span className="sm:hidden">App</span>
      </button>

      {showIosHelp && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 px-4 pb-6 sm:items-center sm:pb-0"
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
                className="text-slate-400 hover:text-slate-700"
              >
                <X size={16} />
              </button>
            </div>
            <ol className="mt-4 space-y-3 text-sm text-slate-600">
              <li className="flex items-center gap-2.5">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-700">1</span>
                <span className="flex items-center gap-1.5">
                  Tap <Share size={14} className="text-sky-600" /> Share at the bottom of Safari
                </span>
              </li>
              <li className="flex items-center gap-2.5">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-700">2</span>
                <span className="flex items-center gap-1.5">
                  Choose <Plus size={14} className="text-slate-700" /> Add to Home Screen
                </span>
              </li>
              <li className="flex items-center gap-2.5">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-700">3</span>
                <span>Tap Add — it opens straight to your dashboard</span>
              </li>
            </ol>
            <p className="mt-4 text-[11px] leading-relaxed text-slate-400">
              Works in Safari only. If you&apos;re in Chrome or another browser on iPhone,
              open this page in Safari first.
            </p>
          </div>
        </div>
      )}
    </>
  )
}
