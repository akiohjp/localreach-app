import type { SupportedLocale } from '@/types/database'

const ALL_LOCALES: SupportedLocale[] = ['en', 'ja', 'ar']

/**
 * Locales we are willing to put in front of a paying client's guests.
 *
 * The generator ships EN/JA/AR, but only English has been read end-to-end and
 * cleared. Arabic breaks gender agreement systematically (`عيادة` is feminine,
 * the pools address it as masculine) and carries English calques; the Japanese
 * pool calls a clinic 「お店」. A tab a guest can tap is a tab we are shipping,
 * and a broken review lands on the client's own Google profile — that costs
 * more than the extra language earns while we sell in English.
 *
 * So the guest surface is narrowed to what we can defend. None of the JA/AR
 * generation is removed: the pools, the RTL layout and the review-language
 * plumbing all stay wired, gated here (2026-08-10 owner decision — reopen per
 * locale once a client needs it and the pool has been read by a native).
 *
 * Reopening takes no code change: set NEXT_PUBLIC_ENABLED_LOCALES="en,ja,ar"
 * (or "en,ar") in the environment and redeploy.
 */
export const ENABLED_LOCALES: SupportedLocale[] = parseEnabled(
  process.env.NEXT_PUBLIC_ENABLED_LOCALES,
)

function parseEnabled(raw: string | undefined): SupportedLocale[] {
  const parsed = (raw ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter((s): s is SupportedLocale => (ALL_LOCALES as string[]).includes(s))
  // An empty or garbage value must not silently produce a page with no language
  // at all — fall back to the locale we know is clean.
  return parsed.length > 0 ? Array.from(new Set(parsed)) : ['en']
}

/**
 * The locales this store actually offers, gated.
 *
 * `filled` is what the owner configured: the store's default language plus any
 * locale key present in store_name / greeting_text. A store that never set up
 * Arabic must not be handed an Arabic tab, gate or no gate.
 *
 * The store's own default language always survives the gate. A Tokyo sushi shop
 * whose page is Japanese must not be flipped to English-only because the UAE
 * roadmap says English first — that would break a live store to enforce a
 * sales decision about which language we polish next.
 */
export function localesForStore(store: {
  default_language: SupportedLocale
  store_name: Record<string, string> | null
  greeting_text: Record<string, string> | null
}): SupportedLocale[] {
  const filled = new Set<string>([store.default_language])
  for (const src of [store.store_name, store.greeting_text]) {
    for (const [k, v] of Object.entries(src ?? {})) {
      if (typeof v === 'string' && v.trim()) filled.add(k)
    }
  }
  const list = ALL_LOCALES.filter(
    (l) =>
      filled.has(l) && (ENABLED_LOCALES.includes(l) || l === store.default_language),
  )
  return list.length > 0 ? list : [store.default_language]
}

/**
 * Locale list for owner-facing pickers (content tabs, WhatsApp message language).
 * Same rule as the guest side, so the owner never edits or previews a language
 * their guests cannot reach.
 */
export function ownerLocaleOptions(
  defaultLanguage: SupportedLocale,
): SupportedLocale[] {
  return ALL_LOCALES.filter(
    (l) => ENABLED_LOCALES.includes(l) || l === defaultLanguage,
  )
}
