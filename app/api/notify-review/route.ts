import { NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'

/** When Origin is sent, allow only this host or NEXT_PUBLIC_APP_URL (cross-site POST spam). */
function notifyOriginAllowed(request: Request): boolean {
  if (process.env.NODE_ENV !== 'production') return true
  const origin = request.headers.get('origin')
  if (!origin) return true
  const allowed = new Set<string>()
  try {
    allowed.add(new URL(request.url).origin)
  } catch {
    return false
  }
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (configured) {
    try {
      allowed.add(new URL(configured).origin)
    } catch {
      /* ignore */
    }
  }
  return allowed.has(origin)
}

// ── Email template ────────────────────────────────────────────────────────────
function buildEmailHtml({
  name,
  storeName,
  reviewSnippet,
  dashboardUrl,
}: {
  name: string
  storeName: string
  reviewSnippet?: string | null
  dashboardUrl: string
}): string {
  const snippetBlock = reviewSnippet
    ? `<tr>
        <td style="padding:24px 40px 0;">
          <div style="background:#fdfaf0;border-left:4px solid #D4AF37;border-radius:0 12px 12px 0;padding:16px 20px;">
            <p style="margin:0;font-size:14px;color:#555;line-height:1.7;font-style:italic;">
              &ldquo;${reviewSnippet.replace(/</g, '&lt;').replace(/>/g, '&gt;')}&rdquo;
            </p>
          </div>
        </td>
      </tr>`
    : ''

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>New 5-Star Review — ${storeName}</title>
</head>
<body style="margin:0;padding:0;background-color:#f0f0f0;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
    style="background:#f0f0f0;padding:48px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0"
          style="max-width:560px;width:100%;background:#ffffff;border-radius:20px;
                 overflow:hidden;box-shadow:0 8px 48px rgba(0,0,0,0.12);">

          <!-- Dark header -->
          <tr>
            <td style="background:#0a0a0a;padding:40px 40px 32px;text-align:center;">
              <p style="margin:0 0 14px;font-size:10px;font-weight:700;letter-spacing:3px;
                        text-transform:uppercase;color:#D4AF37;">
                LocalReach &middot; Review Alert
              </p>
              <h1 style="margin:0;font-size:28px;font-weight:900;color:#ffffff;line-height:1.25;">
                🎉 Boom! New 5-Star<br>Review Just Dropped!
              </h1>
            </td>
          </tr>

          <!-- Gold shimmer bar -->
          <tr>
            <td style="height:5px;background:linear-gradient(90deg,#B8961C 0%,#D4AF37 50%,#B8961C 100%);"></td>
          </tr>

          <!-- Stars + reviewer name -->
          <tr>
            <td style="padding:36px 40px 0;text-align:center;">
              <p style="margin:0;font-size:32px;letter-spacing:6px;">⭐⭐⭐⭐⭐</p>
              <p style="margin:16px 0 0;font-size:15px;color:#888;font-weight:500;">
                A new review was posted by
              </p>
              <p style="margin:6px 0 0;font-size:24px;font-weight:900;color:#111;">
                ${name}
              </p>
            </td>
          </tr>

          ${snippetBlock}

          <!-- Body copy -->
          <tr>
            <td style="padding:28px 40px 0;">
              <p style="margin:0;font-size:14px;color:#777;line-height:1.8;text-align:center;">
                Your LocalReach system just converted another happy customer into a verified
                Google review. Every new review strengthens your Maps ranking and compounds
                your Local SEO advantage over competitors.
              </p>
            </td>
          </tr>

          <!-- Stats strip -->
          <tr>
            <td style="padding:28px 40px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" width="33%"
                    style="border:1px solid #f0f0f0;border-radius:12px;padding:14px 8px;text-align:center;">
                    <p style="margin:0;font-size:22px;font-weight:900;color:#D4AF37;">+1</p>
                    <p style="margin:4px 0 0;font-size:10px;font-weight:600;letter-spacing:1px;
                              text-transform:uppercase;color:#aaa;">Review</p>
                  </td>
                  <td width="12px"></td>
                  <td align="center" width="33%"
                    style="border:1px solid #f0f0f0;border-radius:12px;padding:14px 8px;text-align:center;">
                    <p style="margin:0;font-size:22px;font-weight:900;color:#D4AF37;">5 ⭐</p>
                    <p style="margin:4px 0 0;font-size:10px;font-weight:600;letter-spacing:1px;
                              text-transform:uppercase;color:#aaa;">Rating</p>
                  </td>
                  <td width="12px"></td>
                  <td align="center" width="33%"
                    style="border:1px solid #f0f0f0;border-radius:12px;padding:14px 8px;text-align:center;">
                    <p style="margin:0;font-size:22px;font-weight:900;color:#D4AF37;">↑</p>
                    <p style="margin:4px 0 0;font-size:10px;font-weight:600;letter-spacing:1px;
                              text-transform:uppercase;color:#aaa;">SEO Rank</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CTA button -->
          <tr>
            <td style="padding:36px 40px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${dashboardUrl}"
                      style="display:inline-block;background:#D4AF37;color:#000000;font-size:12px;
                             font-weight:800;letter-spacing:2px;text-transform:uppercase;
                             text-decoration:none;padding:18px 44px;border-radius:100px;
                             box-shadow:0 4px 16px rgba(212,175,55,0.35);">
                      View Your Dashboard &rarr;
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 40px 28px;border-top:1px solid #f5f5f5;text-align:center;">
              <p style="margin:0;font-size:11px;color:#ccc;letter-spacing:0.5px;line-height:1.8;">
                LocalReach &middot; Powered by GAM Solutions L.L.C-FZ<br>
                You are receiving this because you enabled review notifications for
                <strong style="color:#bbb;">${storeName}</strong>.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

// ── Route handler ─────────────────────────────────────────────────────────────
export async function POST(request: Request) {
  try {
    if (!notifyOriginAllowed(request)) {
      return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 })
    }

    const { storeId, customerName, reviewSnippet } = (await request.json()) as {
      storeId: string
      customerName?: string | null
      reviewSnippet?: string | null
    }

    if (!storeId || storeId === 'demo') {
      return NextResponse.json({ ok: true, sent: false, reason: 'demo_or_missing_id' })
    }

    const admin = createAdminClient()
    const { data: store } = await admin
      .from('stores')
      .select('notification_email, store_name')
      .eq('id', storeId)
      .single()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ownerEmail    = (store as any)?.notification_email as string | undefined
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawStoreName  = (store as any)?.store_name
    const storeName: string =
      (typeof rawStoreName === 'object' && rawStoreName !== null
        ? (rawStoreName as Record<string, string>).en ?? Object.values(rawStoreName as Record<string, string>)[0]
        : String(rawStoreName ?? 'Your Store'))

    if (!ownerEmail) {
      return NextResponse.json({ ok: true, sent: false, reason: 'no_notification_email' })
    }

    const name = customerName?.trim() || 'A happy customer'
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    const dashboardUrl = `${appUrl}/admin`

    const htmlBody = buildEmailHtml({ name, storeName, reviewSnippet, dashboardUrl })
    const subject  = `🎉 New 5-Star Review from ${name}!`

    // ── Resend (free tier: 3,000 emails / month — zero cost) ─────────────────
    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) {
      // Dev / staging: log without sending
      console.log('[notify-review] No RESEND_API_KEY — would send to:', ownerEmail, '|', subject)
      return NextResponse.json({ ok: true, sent: false, reason: 'no_resend_api_key', preview: subject })
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'LocalReach <info.ae@miraireach.marketing>',
        to: [ownerEmail],
        subject,
        html: htmlBody,
      }),
    })

    if (!res.ok) {
      const detail = await res.text()
      console.error('[notify-review] Resend error:', detail)
      return NextResponse.json({ ok: false, error: 'Email delivery failed' }, { status: 502 })
    }

    return NextResponse.json({ ok: true, sent: true })
  } catch (err) {
    console.error('[notify-review] Unexpected error:', err)
    return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500 })
  }
}
