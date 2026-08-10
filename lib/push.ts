import webpush from 'web-push'
import { createAdminClient } from '@/utils/supabase/admin'

/**
 * Web Push to the owner's devices.
 *
 * Why push and not email: this app has no mail sender (the old notify route was
 * removed) and no WhatsApp API. It IS already a PWA with a registered service
 * worker and an "Install app" button, so push is the one channel that reaches a
 * phone without the owner deciding to open the dashboard — which is the whole
 * problem. Feedback has been landing in a table nobody was told about, and
 * staff read that as "we never get feedback".
 *
 * Everything here is best-effort by design. A push failure must never surface
 * to the guest: their feedback is already saved by the time we get here.
 */

const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ''
const PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY ?? ''
/** mailto the push service can contact if this app misbehaves; required by the spec. */
const CONTACT = process.env.VAPID_CONTACT ?? 'mailto:info@miraireach.marketing'

export function pushConfigured(): boolean {
  return PUBLIC_KEY.length > 0 && PRIVATE_KEY.length > 0
}

const TOPIC_LABEL: Record<string, string> = {
  service: 'service',
  wait: 'waiting time',
  quality: 'quality',
  cleanliness: 'cleanliness',
  price: 'price',
  other: 'something else',
}

/**
 * One line the owner can act on from the lock screen. The rating leads because
 * it decides whether this needs a reply today; the topics come next because
 * they say what to look at; the guest's own words are the tail.
 */
function buildBody(rating: number, message: string, topics: string[]): string {
  const stars = '★'.repeat(Math.max(1, Math.min(5, rating)))
  const topicPart = topics.length
    ? ` · ${topics.map((t) => TOPIC_LABEL[t] ?? t).join(', ')}`
    : ''
  const text = message.trim()
  const head = `${stars}${topicPart}`
  if (!text) return head
  const room = 120 - head.length - 3
  return `${head} — ${text.length > room ? `${text.slice(0, Math.max(20, room))}…` : text}`
}

export async function notifyStore(
  storeId: string,
  rating: number,
  message: string,
  topics: string[],
): Promise<void> {
  if (!pushConfigured()) return

  webpush.setVapidDetails(CONTACT, PUBLIC_KEY, PRIVATE_KEY)
  const admin = createAdminClient()

  const { data: subs, error } = await admin
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('store_id', storeId)
    .is('expired_at', null)

  if (error) {
    console.error('[push] subscription lookup failed', error)
    return
  }
  if (!subs || subs.length === 0) return

  const payload = JSON.stringify({
    title: 'New guest feedback',
    body: buildBody(rating, message, topics),
    url: `/admin/${storeId}?tab=customers`,
    tag: `feedback-${storeId}`,
  })

  const dead: string[] = []
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
        )
      } catch (err) {
        // 404/410 means the browser threw the subscription away (app removed,
        // permission revoked). Retrying it forever is how a push sender ends up
        // rate-limited, so it is retired instead.
        const status = (err as { statusCode?: number })?.statusCode
        if (status === 404 || status === 410) dead.push(s.id)
        else console.error('[push] send failed', status, err)
      }
    }),
  )

  const now = new Date().toISOString()
  if (dead.length) {
    await admin.from('push_subscriptions').update({ expired_at: now }).in('id', dead)
  }
  const alive = subs.filter((s) => !dead.includes(s.id)).map((s) => s.id)
  if (alive.length) {
    await admin.from('push_subscriptions').update({ last_sent_at: now }).in('id', alive)
  }
}
