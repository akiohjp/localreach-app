'use client'

import { useEffect } from 'react'

/**
 * Tells /api/view that this guest opened the page, once per browser session.
 *
 * Fires from the browser rather than the server render so that WhatsApp,
 * iMessage and Slack building a preview card for a forwarded link do not read
 * as a visit. The sessionStorage guard keeps a reload or a language switch from
 * counting twice; a genuine second visit opens a new session and counts again.
 *
 * Silent by design: a blocked or failed beacon must never reach the guest.
 */
export default function ViewBeacon({
  storeId,
  entry,
  locale,
}: {
  storeId: string
  entry: 'r' | 'store'
  locale: string
}) {
  useEffect(() => {
    const key = `lr:view:${storeId}`
    let sessionId = ''
    try {
      if (sessionStorage.getItem(key)) return
      sessionId =
        globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
      sessionStorage.setItem(key, sessionId)
    } catch {
      // Private mode or storage disabled: log the open anyway, without an id.
    }

    const payload = JSON.stringify({
      storeId,
      entry,
      locale,
      sessionId: sessionId || null,
      referrer: document.referrer || null,
    })
    // keepalive so the row survives the guest tapping straight through to the
    // first step and the request outliving this render.
    void fetch('/api/view', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      keepalive: true,
    }).catch(() => {})
  }, [storeId, entry, locale])

  return null
}
