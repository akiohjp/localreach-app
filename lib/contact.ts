/**
 * How anyone reaches US — mirAIreach, who runs LocalReach. Not a store's
 * details: lib/whatsapp builds links from the number an owner or a guest
 * gave us, and those stay per-store.
 *
 * One place, because the copies drifted apart and two of the three were
 * dead ends (owner read, 2026-09-11): the paused-subscription screen sent
 * owners to a client's own WhatsApp, the detail page's "Book a Free Demo"
 * wrote to info@gam-solutions.com and the push contact to
 * info@miraireach.marketing — neither address exists, so those mails
 * bounce. info.ae@ is the mailbox that is actually live.
 */

/** The only mailbox that receives. */
export const SUPPORT_EMAIL = 'info.ae@miraireach.marketing'

/** Our WhatsApp, digits only, for wa.me links. */
export const SUPPORT_WA_NUMBER = '971557810053'

/** Click-to-chat link to us, optionally pre-filled with a first message. */
export function supportWaLink(text?: string): string {
  const base = `https://wa.me/${SUPPORT_WA_NUMBER}`
  return text ? `${base}?text=${encodeURIComponent(text)}` : base
}

/** mailto: to us, with an optional subject line. */
export function supportMailto(subject?: string): string {
  const base = `mailto:${SUPPORT_EMAIL}`
  return subject ? `${base}?subject=${encodeURIComponent(subject)}` : base
}
