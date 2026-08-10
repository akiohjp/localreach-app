'use client'
import { useEffect, useState } from 'react'
import { Bell, BellOff, BellRing, Loader2 } from 'lucide-react'

/**
 * Turn on push for new guest feedback.
 *
 * The feature this unlocks already existed and nobody knew: private notes have
 * been landing in a table that only opens if the owner decides to go looking,
 * and staff read that as "we never get feedback". Push is the only channel this
 * app can use — there is no mail sender and no WhatsApp API — and it works
 * because the app is already installable with a registered service worker.
 *
 * The states are spelled out rather than collapsed into one button, because
 * every failure here is silent by nature: a blocked permission, an iPhone that
 * has not been added to the home screen, or a browser with no push support all
 * look identical to "I pressed it and nothing happened".
 */

type State = 'checking' | 'unsupported' | 'needs-install' | 'blocked' | 'off' | 'on' | 'working'

function urlBase64ToArrayBuffer(base64: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'))
  const buf = new ArrayBuffer(raw.length)
  const view = new Uint8Array(buf)
  for (let i = 0; i < raw.length; i++) view[i] = raw.charCodeAt(i)
  return buf
}

export default function NotificationToggle({
  storeId,
  vapidPublicKey,
}: {
  storeId: string
  vapidPublicKey: string
}) {
  const [state, setState] = useState<State>('checking')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      if (!vapidPublicKey) return !cancelled && setState('unsupported')
      if (typeof window === 'undefined') return
      const supported =
        'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
      if (!supported) {
        // iOS only exposes PushManager to an installed PWA, so "not supported"
        // on an iPhone almost always means "not added to the home screen yet".
        const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const standalone = (window.navigator as any).standalone === true
        return !cancelled && setState(iOS && !standalone ? 'needs-install' : 'unsupported')
      }
      if (Notification.permission === 'denied') return !cancelled && setState('blocked')
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (!cancelled) setState(sub ? 'on' : 'off')
    })()
    return () => {
      cancelled = true
    }
  }, [vapidPublicKey])

  async function enable() {
    setError(null)
    setState('working')
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setState(permission === 'denied' ? 'blocked' : 'off')
        return
      }
      const reg = await navigator.serviceWorker.ready
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToArrayBuffer(vapidPublicKey),
        }))
      const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } }
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ store_id: storeId, endpoint: json.endpoint, keys: json.keys }),
      })
      if (!res.ok) {
        // Leaving the browser subscription in place while the server does not
        // know about it is the worst outcome: the switch looks on and nothing
        // ever arrives. Undo it so the state stays honest.
        await sub.unsubscribe().catch(() => {})
        setError('Could not save it on our side. Please try again.')
        setState('off')
        return
      }
      setState('on')
    } catch (err) {
      console.error('[push] enable failed', err)
      setError('Your browser refused to switch it on.')
      setState('off')
    }
  }

  async function disable() {
    setState('working')
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await fetch('/api/push/subscribe', {
          method: 'DELETE',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ store_id: storeId, endpoint: sub.endpoint }),
        }).catch(() => {})
        await sub.unsubscribe()
      }
      setState('off')
    } catch (err) {
      console.error('[push] disable failed', err)
      setState('on')
    }
  }

  const shell = 'rounded-xl border px-4 py-3 text-xs leading-relaxed'

  if (state === 'checking') {
    return (
      <div className={`${shell} border-gray-200 bg-gray-50 text-slate-400 flex items-center gap-2`}>
        <Loader2 size={13} className="animate-spin" /> Checking notifications…
      </div>
    )
  }
  if (state === 'needs-install') {
    return (
      <div className={`${shell} border-amber-200 bg-amber-50 text-amber-900`}>
        <strong>Add this to your home screen first.</strong> On iPhone, notifications only work once
        the dashboard is installed — use <strong>Install app</strong> at the top, then come back here.
      </div>
    )
  }
  if (state === 'unsupported') {
    return (
      <div className={`${shell} border-gray-200 bg-gray-50 text-slate-500`}>
        This browser cannot send notifications. Open the dashboard in Chrome or Safari on your phone.
      </div>
    )
  }
  if (state === 'blocked') {
    return (
      <div className={`${shell} border-amber-200 bg-amber-50 text-amber-900`}>
        <strong>Notifications are blocked for this site.</strong> Turn them back on in your browser
        settings for this page, then reload.
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={state === 'on' ? disable : enable}
        disabled={state === 'working'}
        className={`w-full rounded-xl px-4 py-3 text-sm font-semibold transition-all active:scale-[0.99]
          flex items-center justify-center gap-2 ${
            state === 'on'
              ? 'border border-green-200 bg-green-50 text-green-800 hover:bg-green-100'
              : 'bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-40'
          }`}
      >
        {state === 'working' ? (
          <Loader2 size={14} className="animate-spin" />
        ) : state === 'on' ? (
          <BellRing size={14} />
        ) : (
          <Bell size={14} />
        )}
        {state === 'on' ? 'Notifications are on for this device' : 'Notify me on this device'}
      </button>
      <p className="text-[11px] text-slate-500 leading-relaxed flex items-start gap-1.5">
        {state === 'on' ? (
          <>
            <BellOff size={11} className="mt-0.5 shrink-0" />
            Tap again to stop. Each phone or computer is switched on separately.
          </>
        ) : (
          <>New guest feedback reaches this device without opening the dashboard.</>
        )}
      </p>
      {error && <p className="text-[11px] text-red-500">{error}</p>}
    </div>
  )
}
