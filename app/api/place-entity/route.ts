import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

/**
 * GET /api/place-entity?placeId=ChIJ...
 *
 * Owner-dashboard helper: resolve a Google Place into the entity fields the
 * review engine weaves (area / city / category noun), so the owner doesn't
 * have to type them. The place id comes from the store's own Google review
 * link (…writereview?placeid=ChIJ…), i.e. data the owner already provided.
 *
 * Requires an authenticated session (costs Places API money) and the server
 * env GOOGLE_MAPS_API_KEY; without the key it returns 501 and the dashboard
 * falls back to manual entry. Only EN labels are fetched — JA/AR labels stay
 * a manual (optional) refinement.
 */

// Place IDs are url-safe base64-ish tokens; be strict before interpolating.
const PLACE_ID_RE = /^[A-Za-z0-9_-]{10,200}$/

type AddressComponent = {
  longText?: string
  types?: string[]
}

function componentOf(components: AddressComponent[], ...types: string[]): string | null {
  for (const t of types) {
    const hit = components.find((c) => c.types?.includes(t))
    if (hit?.longText) return hit.longText
  }
  return null
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const key = process.env.GOOGLE_MAPS_API_KEY
  if (!key) {
    return NextResponse.json({ error: 'not_configured' }, { status: 501 })
  }

  const placeId = req.nextUrl.searchParams.get('placeId') ?? ''
  if (!PLACE_ID_RE.test(placeId)) {
    return NextResponse.json({ error: 'invalid_place_id' }, { status: 400 })
  }

  const res = await fetch(
    `https://places.googleapis.com/v1/places/${placeId}?languageCode=en`,
    {
      headers: {
        'X-Goog-Api-Key': key,
        'X-Goog-FieldMask': 'addressComponents,primaryTypeDisplayName',
      },
      // Entity data is stable; avoid re-billing on double-clicks.
      next: { revalidate: 3600 },
    },
  )
  if (!res.ok) {
    return NextResponse.json({ error: 'places_error', status: res.status }, { status: 502 })
  }

  const place = (await res.json()) as {
    addressComponents?: AddressComponent[]
    primaryTypeDisplayName?: { text?: string }
  }
  const components = place.addressComponents ?? []

  // Dubai quirk: `locality` is often absent; the emirate arrives as
  // administrative_area_level_1 ("Dubai"). Sublocality carries the area.
  const area = componentOf(
    components,
    'sublocality_level_1',
    'sublocality',
    'neighborhood',
  )
  const city = componentOf(components, 'locality', 'administrative_area_level_1')

  // "Japanese Restaurant" → "Japanese restaurant" (mid-sentence noun).
  const raw = place.primaryTypeDisplayName?.text ?? null
  const category = raw
    ? raw.charAt(0) + raw.slice(1).toLowerCase().replace(/\brestaurant\b/i, 'restaurant')
    : null

  return NextResponse.json({ area, city, category })
}
