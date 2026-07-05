// ─────────────────────────────────────────────
// WhatsApp review-request helpers (Phase 1: click-to-chat, no Meta API)
//
// The store owner sends review requests from their OWN WhatsApp via wa.me
// click-to-chat links. No WhatsApp Business API, no per-message fees, and —
// because the owner only messages customers who already gave their number —
// it stays within an existing-customer relationship (PDPL-friendly).
// ─────────────────────────────────────────────

export type WaLocale = 'en' | 'ja' | 'ar'

/**
 * Default review-request message per locale. `{store}` is the shop name and
 * `{link}` is the customer-facing review page (the LocalReach funnel, NOT the
 * raw Google link — we want them to go through the multilingual funnel).
 */
export function waTemplate(locale: WaLocale, store: string, link: string): string {
  switch (locale) {
    case 'ja':
      return `${store}をご利用いただきありがとうございました！\n30秒で簡単なレビューをいただけると嬉しいです🙏\n${link}`
    case 'ar':
      return `مرحباً! شكراً لزيارتك ${store}.\nهل يمكنك ترك تقييم سريع خلال 30 ثانية؟ هذا يساعدنا كثيراً 🙏\n${link}`
    case 'en':
    default:
      return `Hi! Thanks for visiting ${store}.\nCould you take 30 seconds to leave us a quick review? It really helps us 🙏\n${link}`
  }
}

/**
 * Digits-only phone number for wa.me (strip +, spaces, dashes, trunk noise).
 * Returns '' when there is nothing dialable — callers then fall back to the
 * WhatsApp share sheet (pick a contact / broadcast).
 */
export function normalizeWaNumber(raw: string): string {
  return (raw || '').replace(/\D/g, '')
}

/**
 * Build a WhatsApp click-to-chat link. With a number it opens a chat to that
 * contact pre-filled with the message; without one it opens WhatsApp's share
 * sheet so the owner can pick a contact or paste into a broadcast list.
 */
export function buildWaLink(number: string, text: string): string {
  const n = normalizeWaNumber(number)
  const t = encodeURIComponent(text)
  return n ? `https://wa.me/${n}?text=${t}` : `https://wa.me/?text=${t}`
}
