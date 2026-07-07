/**
 * Contract-end lockout, shared by every base-table gate (admin dashboard,
 * feedback + customer-leads APIs). The public QR page needs no check here —
 * the public_store_review view already exposes the effective is_active
 * (see migration 20260707000000_add_subscription_expires_at.sql).
 *
 * Effective active = manual kill switch ON AND contract end not passed.
 * NULL / undefined expiry = no expiry (unlimited).
 */
export function isStoreCurrentlyActive(store: {
  is_active: boolean
  subscription_expires_at?: string | null
}): boolean {
  if (!store.is_active) return false
  if (!store.subscription_expires_at) return true
  const expires = Date.parse(store.subscription_expires_at)
  return Number.isNaN(expires) ? true : expires > Date.now()
}
