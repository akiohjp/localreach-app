import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'LocalReach — AI-Powered Review Growth for Dubai Businesses',
  description:
    'Turn every customer visit into a unique Google review and a WhatsApp contact. 100% Google policy compliant.',
}

const GOLD = '#C9A84C'
const GOLD_LIGHT = '#F5E6C0'
const GOLD_DARK = '#A07820'

// ── Floating review card data ─────────────────────────────────────
const REVIEW_CARDS = [
  {
    initial: 'A', color: '#4285F4', name: 'Ahmed M.', stars: 5,
    text: 'Incredible atmosphere and authentic flavors. The salmon sashimi was absolutely flawless — will definitely return!',
    time: '2 days ago', cls: 'card-float-a',
    style: { transform: 'rotate(-2deg)', zIndex: 30, top: '0px', left: '0px' },
  },
  {
    initial: 'Y', color: '#34A853', name: 'Yuki T.', stars: 5,
    text: 'Best omakase experience in Dubai Marina. Exceptional fresh ingredients and warm hospitality every visit.',
    time: '1 week ago', cls: 'card-float-b',
    style: { transform: 'rotate(1.5deg)', zIndex: 20, top: '120px', left: '30px' },
  },
  {
    initial: 'S', color: '#EA4335', name: 'Sarah K.', stars: 5,
    text: 'Staff were incredibly welcoming. Great Japanese whisky selection too. Highly recommended!',
    time: '3 days ago', cls: 'card-float-c',
    style: { transform: 'rotate(-1deg)', zIndex: 10, top: '240px', left: '10px' },
  },
]

const PAIN_POINTS = [
  { icon: '📉', title: 'Reviews Aren\'t Growing', body: 'Even happy customers forget to post. Without a frictionless system, your Google rating stagnates while competitors climb the map.' },
  { icon: '🔁', title: 'No Path to Repeat Visits', body: 'You invest in every guest experience but leave with zero contact information. No list means no re-engagement, ever.' },
  { icon: '🚫', title: 'Spam Penalties Loom', body: 'Templated tools produce identical text that triggers Google\'s spam detection — risking the suspension of your entire Business Profile.' },
]

const HOW_STEPS = [
  { n: '01', icon: '📱', title: 'Customer Scans QR', body: 'A branded QR code at the table opens the LocalReach experience — no app download, no friction.' },
  { n: '02', icon: '⭐', title: 'Satisfaction Survey', body: 'A compliance buffer: customers rate their experience first. This framing satisfies Google\'s feedback-first guidelines.' },
  { n: '03', icon: '🤖', title: 'AI Generates Unique Review', body: 'Our assembler randomly combines openers, GEO keywords, and closers — producing a never-repeated, natural-language review.' },
  { n: '04', icon: '✅', title: 'Posted + Contact Captured', body: 'The review goes live on Google. Optionally, the customer shares their WhatsApp number — building your CRM automatically.' },
]

const FEATURES = [
  {
    icon: '🤖', tag: 'AI-Powered Local SEO',
    title: 'Every Review Is Unique. Every Time.',
    bullets: [
      'Random sentence assembly — no two reviews share the same structure',
      'GEO Keywords woven naturally to lift local search ranking',
      'Zero spam signals: avoids Google\'s duplicate-content filters',
      'Generates in real-time on the client — zero API cost',
    ],
  },
  {
    icon: '📲', tag: 'Stealth CRM · WhatsApp Integration',
    title: 'Build Your Customer Asset List Passively',
    bullets: [
      'WhatsApp opt-in embedded in the review flow — feels natural',
      'Captures number, opt-in status, and selected keywords per customer',
      'CSV export available in the master dashboard at any time',
      'Full international dialling code support for Dubai\'s expat market',
    ],
  },
  {
    icon: '🌍', tag: 'Global Optimization',
    title: 'Dubai\'s Multicultural Market, Fully Served',
    bullets: [
      'English, Japanese, and Arabic UI with automatic RTL layout',
      'Any country code registration — from +44 London to +81 Tokyo',
      'Locale-aware review generation matches visitor language',
      'Brand color + logo customization per store',
    ],
  },
]

const COMPARISON_ROWS = [
  { feature: 'AI Individual Review Generation', lr: '✓  High Quality', gen: '△  Templates only', pop: '✗' },
  { feature: 'CRM · WhatsApp Integration',       lr: '✓  Automatic',   gen: '✗',                pop: '✗' },
  { feature: 'Local SEO / GEO Keyword Effect',   lr: 'High',           gen: 'Low',               pop: 'None' },
  { feature: 'Multi-language Support',            lr: '✓  EN / JA / AR', gen: '△  EN only',      pop: '✗' },
  { feature: 'Spam Protection',                   lr: 'Advanced AI',    gen: 'Basic',             pop: 'N/A' },
  { feature: 'Guideline Compliance',              lr: '✓  Compliant',   gen: '✗  Risk',           pop: 'N/A' },
]

// ── Sub-components ────────────────────────────────────────────────

function Stars({ n }: { n: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: n }).map((_, i) => (
        <span key={i} style={{ color: '#FBBC04', fontSize: 14 }}>★</span>
      ))}
    </div>
  )
}

function GooglePin() {
  return (
    <svg width="22" height="26" viewBox="0 0 22 26" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M11 0C4.925 0 0 4.925 0 11c0 7.333 11 15 11 15S22 18.333 22 11C22 4.925 17.075 0 11 0Z" fill="#EA4335" />
      <circle cx="11" cy="11" r="5" fill="white" />
    </svg>
  )
}

function GoogleReviewCard({ card }: { card: typeof REVIEW_CARDS[0] }) {
  return (
    <div
      className={`${card.cls} absolute w-72 bg-white rounded-2xl shadow-2xl p-4 border border-gray-100`}
      style={card.style}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
            style={{ backgroundColor: card.color }}
          >
            {card.initial}
          </div>
          <div>
            <p className="text-xs font-bold text-slate-800">{card.name}</p>
            <Stars n={card.stars} />
          </div>
        </div>
        <GooglePin />
      </div>
      {/* Review text */}
      <p className="text-[11px] text-slate-600 leading-relaxed line-clamp-3">{card.text}</p>
      {/* Footer */}
      <div className="mt-3 flex items-center justify-between">
        <span className="text-[10px] text-slate-400">{card.time}</span>
        <span className="text-[10px] font-semibold text-blue-500">Google Maps</span>
      </div>
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-bold tracking-[0.3em] uppercase mb-2" style={{ color: GOLD }}>
      {children}
    </p>
  )
}

// ── Page ──────────────────────────────────────────────────────────

export default function LocalReachDetailPage() {
  return (
    <>
      <style>{`
        @keyframes floatA {
          0%,100% { transform: translateY(0px)   rotate(-2deg); }
          50%      { transform: translateY(-18px) rotate(-2deg); }
        }
        @keyframes floatB {
          0%,100% { transform: translateY(-6px) rotate(1.5deg); }
          50%      { transform: translateY(12px) rotate(1.5deg); }
        }
        @keyframes floatC {
          0%,100% { transform: translateY(6px)   rotate(-1deg); }
          50%      { transform: translateY(-14px) rotate(-1deg); }
        }
        @keyframes fadeInUp {
          from { opacity:0; transform:translateY(28px); }
          to   { opacity:1; transform:translateY(0);    }
        }
        @keyframes shimmer {
          0%   { background-position: -200% center; }
          100% { background-position:  200% center; }
        }
        @keyframes pulseDot {
          0%,100% { opacity:1; transform:scale(1);   }
          50%      { opacity:.5; transform:scale(1.3); }
        }
        @keyframes gradientBg {
          0%   { background-position: 0%   50%; }
          50%  { background-position: 100% 50%; }
          100% { background-position: 0%   50%; }
        }
        @keyframes countUp {
          from { opacity:0; transform:translateY(10px); }
          to   { opacity:1; transform:translateY(0);    }
        }
        .card-float-a { animation: floatA 4s ease-in-out infinite; }
        .card-float-b { animation: floatB 5.5s ease-in-out infinite 0.8s; }
        .card-float-c { animation: floatC 4.8s ease-in-out infinite 1.6s; }
        .fade-up-1 { animation: fadeInUp .7s ease-out .1s both; }
        .fade-up-2 { animation: fadeInUp .7s ease-out .3s both; }
        .fade-up-3 { animation: fadeInUp .7s ease-out .5s both; }
        .fade-up-4 { animation: fadeInUp .7s ease-out .7s both; }
        .shimmer-gold {
          background: linear-gradient(90deg, #C9A84C 0%, #F5E6C0 40%, #F0C040 60%, #C9A84C 100%);
          background-size: 200% auto;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: shimmer 3s linear infinite;
        }
        .pulse-dot { animation: pulseDot 1.8s ease-in-out infinite; }
        .hero-bg {
          background: linear-gradient(135deg, #060B14 0%, #0F1A2E 40%, #0A1220 70%, #060B14 100%);
          background-size: 300% 300%;
          animation: gradientBg 10s ease infinite;
        }
        .stat-count { animation: countUp .6s ease-out .9s both; }
        .grid-dots {
          background-image: radial-gradient(circle, rgba(201,168,76,0.15) 1px, transparent 1px);
          background-size: 32px 32px;
        }
      `}</style>

      <div className="bg-white text-slate-900">

        {/* ── Sticky Nav ──────────────────────────────────────────── */}
        <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-100 shadow-sm">
          <div className="mx-auto max-w-6xl px-6 py-3.5 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-xl font-black text-slate-900">Local</span>
              <span className="text-xl font-black" style={{ color: GOLD }}>Reach</span>
              <span className="ml-2 text-[9px] font-bold tracking-widest uppercase px-2 py-0.5 rounded-full border"
                style={{ borderColor: GOLD, color: GOLD }}>
                by GAM Solutions
              </span>
            </div>
            <div className="flex items-center gap-3">
              <a href="#how-it-works" className="hidden sm:block text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors">
                How It Works
              </a>
              <a href="#compliance" className="hidden sm:block text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors">
                Compliance
              </a>
              <a
                href="#book-demo"
                className="rounded-xl px-5 py-2 text-sm font-black text-white shadow-lg hover:opacity-90 active:scale-[0.97] transition-all"
                style={{ backgroundColor: GOLD }}
              >
                Book a Demo
              </a>
            </div>
          </div>
        </nav>

        {/* ── Hero ────────────────────────────────────────────────── */}
        <section className="hero-bg relative overflow-hidden min-h-[92vh] flex items-center">
          {/* Grid dot overlay */}
          <div className="absolute inset-0 grid-dots opacity-60" />
          {/* Gold glow */}
          <div className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full opacity-10"
            style={{ background: `radial-gradient(circle, ${GOLD} 0%, transparent 65%)` }} />
          <div className="absolute -bottom-40 -left-20 w-[400px] h-[400px] rounded-full opacity-8"
            style={{ background: `radial-gradient(circle, #4285F4 0%, transparent 65%)` }} />

          <div className="relative mx-auto max-w-6xl px-6 w-full py-20">
            <div className="flex flex-col lg:flex-row items-center gap-16">

              {/* ── Left: Copy ──────────────────────────────────── */}
              <div className="flex-1 space-y-7 text-white">
                {/* Live badge */}
                <div className="fade-up-1 flex items-center gap-2 w-fit">
                  <span className="pulse-dot w-2 h-2 rounded-full bg-green-400 inline-block" />
                  <span className="text-xs font-bold tracking-widest uppercase text-green-400">
                    Live · Google Reviews Growing in Real-Time
                  </span>
                </div>

                {/* Headline */}
                <div className="fade-up-2 space-y-2">
                  <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black leading-[1.0] tracking-tight">
                    Turn Every Visit<br />
                    Into a{' '}
                    <span className="shimmer-gold">5-Star Review.</span>
                  </h1>
                  <p className="text-lg sm:text-xl text-slate-300 leading-relaxed max-w-xl pt-2">
                    LocalReach&apos;s AI generates a unique, spam-proof Google review for every customer —
                    while quietly building your WhatsApp contact list in the background.
                  </p>
                </div>

                {/* Stats */}
                <div className="fade-up-3 flex flex-wrap gap-6">
                  {[
                    { val: '3×', label: 'Faster Review Growth' },
                    { val: '100%', label: 'Google Compliant' },
                    { val: 'Zero', label: 'Spam Risk' },
                  ].map(({ val, label }) => (
                    <div key={label} className="stat-count">
                      <p className="text-3xl font-black" style={{ color: GOLD }}>{val}</p>
                      <p className="text-xs text-slate-400 font-semibold mt-0.5">{label}</p>
                    </div>
                  ))}
                </div>

                {/* CTA */}
                <div className="fade-up-4 flex flex-col sm:flex-row gap-3 pt-2">
                  <a
                    href="#book-demo"
                    className="inline-flex items-center justify-center gap-2 rounded-xl px-8 py-4
                      text-sm font-black text-white shadow-2xl hover:opacity-90 active:scale-[0.97] transition-all"
                    style={{ backgroundColor: GOLD }}
                  >
                    Book a Free Demo →
                  </a>
                  <a
                    href="#how-it-works"
                    className="inline-flex items-center justify-center gap-2 rounded-xl px-8 py-4
                      text-sm font-bold border border-white/20 text-slate-300 hover:border-white/50
                      hover:text-white transition-all"
                  >
                    See How It Works ↓
                  </a>
                </div>

                {/* Proof strip */}
                <div className="fade-up-4 flex flex-wrap gap-4 pt-1">
                  {['No App Required', 'EN / JA / AR', 'Dubai-Ready', 'GDPR Friendly'].map((t) => (
                    <span
                      key={t}
                      className="text-[11px] font-semibold text-slate-400 border border-white/10
                        rounded-full px-3 py-1"
                    >
                      ✓ {t}
                    </span>
                  ))}
                </div>
              </div>

              {/* ── Right: Floating Google Review Cards ─────────── */}
              <div className="flex-1 flex justify-center lg:justify-end">
                <div className="relative w-80 h-[420px]">
                  {REVIEW_CARDS.map((card) => (
                    <GoogleReviewCard key={card.name} card={card} />
                  ))}

                  {/* Google Maps UI background element */}
                  <div
                    className="absolute -bottom-6 -right-6 w-44 h-36 rounded-2xl overflow-hidden
                      border border-gray-200 shadow-xl opacity-70"
                    style={{ zIndex: 5 }}
                  >
                    {/* Fake map terrain */}
                    <div className="w-full h-full relative"
                      style={{ background: 'linear-gradient(180deg, #E8F5E9 0%, #C8E6C9 40%, #A5D6A7 100%)' }}>
                      {/* Roads */}
                      <div className="absolute top-1/2 left-0 right-0 h-1.5 bg-white/80" />
                      <div className="absolute left-1/3 top-0 bottom-0 w-1 bg-white/60" />
                      <div className="absolute left-2/3 top-0 bottom-0 w-1 bg-white/40" />
                      {/* Block fills */}
                      <div className="absolute top-2 left-2 w-12 h-8 bg-amber-100 rounded opacity-60" />
                      <div className="absolute bottom-2 right-2 w-10 h-7 bg-amber-100 rounded opacity-60" />
                      <div className="absolute top-3 right-6 w-8 h-6 bg-white rounded opacity-50" />
                      {/* Map pin */}
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-full">
                        <svg width="28" height="32" viewBox="0 0 22 26" fill="none">
                          <path d="M11 0C4.925 0 0 4.925 0 11c0 7.333 11 15 11 15S22 18.333 22 11C22 4.925 17.075 0 11 0Z" fill="#EA4335" />
                          <circle cx="11" cy="11" r="4.5" fill="white" />
                          <circle cx="11" cy="11" r="2.5" fill="#EA4335" />
                        </svg>
                      </div>
                      {/* Google Maps label */}
                      <div className="absolute bottom-1.5 left-1.5">
                        <span className="text-[9px] font-bold text-gray-500">Google Maps</span>
                      </div>
                    </div>
                  </div>

                  {/* "New review" notification pop */}
                  <div
                    className="absolute -bottom-3 right-14 bg-white rounded-xl shadow-xl px-3 py-2
                      flex items-center gap-2 border border-gray-100 card-float-b"
                    style={{ zIndex: 40 }}
                  >
                    <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center">
                      <span className="text-xs">⭐</span>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-800">New 5-star review!</p>
                      <p className="text-[9px] text-slate-400">Google Maps · just now</p>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* ── Pain Points ─────────────────────────────────────────── */}
        <section className="py-16 bg-slate-950 text-white border-t border-white/5">
          <div className="mx-auto max-w-6xl px-6">
            <p className="text-center text-sm font-semibold text-slate-500 mb-10 tracking-wider uppercase">
              The challenges every Dubai restaurant owner knows
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {PAIN_POINTS.map(({ icon, title, body }) => (
                <div key={title}
                  className="rounded-2xl border border-white/8 bg-white/5 p-6 hover:border-white/20
                    hover:bg-white/8 transition-all space-y-3">
                  <p className="text-4xl">{icon}</p>
                  <h3 className="text-base font-black text-white">{title}</h3>
                  <p className="text-sm text-slate-400 leading-relaxed">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── How It Works ────────────────────────────────────────── */}
        <section id="how-it-works" className="py-20 bg-white">
          <div className="mx-auto max-w-6xl px-6">
            <div className="text-center mb-14">
              <SectionLabel>The Process</SectionLabel>
              <h2 className="text-4xl sm:text-5xl font-black text-slate-900">
                From QR Scan to Live Google Review<br />
                <span className="text-2xl font-bold text-slate-400">in under 90 seconds.</span>
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 relative">
              {/* Connector line (desktop) */}
              <div className="hidden lg:block absolute top-10 left-[12.5%] right-[12.5%] h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />

              {HOW_STEPS.map(({ n, icon, title, body }) => (
                <div key={n} className="relative text-center space-y-4 p-6 rounded-2xl border border-gray-100 bg-slate-50 hover:shadow-md transition-all">
                  <div className="inline-flex flex-col items-center gap-2">
                    <div
                      className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shadow-sm"
                      style={{ backgroundColor: GOLD_LIGHT }}
                    >
                      {icon}
                    </div>
                    <span className="text-xs font-black text-slate-300">{n}</span>
                  </div>
                  <h4 className="text-sm font-black text-slate-900">{title}</h4>
                  <p className="text-xs text-slate-500 leading-relaxed">{body}</p>
                </div>
              ))}
            </div>

            {/* Mini Google Maps ranking visual */}
            <div className="mt-12 rounded-2xl border border-gray-200 bg-slate-50 p-8">
              <div className="flex flex-col md:flex-row items-center gap-8">
                <div className="shrink-0 space-y-2">
                  <p className="text-xs font-bold text-slate-400 tracking-widest uppercase">Google Maps · Local Pack</p>
                  {/* Fake Google local pack results */}
                  {[
                    { rank: '#1', name: 'Your Restaurant', stars: 4.9, reviews: 247, highlight: true },
                    { rank: '#2', name: 'Competitor A', stars: 4.2, reviews: 89, highlight: false },
                    { rank: '#3', name: 'Competitor B', stars: 3.8, reviews: 44, highlight: false },
                  ].map(({ rank, name, stars, reviews, highlight }) => (
                    <div
                      key={rank}
                      className={`flex items-center gap-4 rounded-xl px-4 py-3 text-sm ${
                        highlight
                          ? 'border-2 bg-white shadow-md'
                          : 'border border-gray-200 bg-white/60'
                      }`}
                      style={highlight ? { borderColor: GOLD } : {}}
                    >
                      <span className={`text-xs font-black w-6 ${highlight ? '' : 'text-slate-400'}`}
                        style={highlight ? { color: GOLD } : {}}>{rank}</span>
                      <div className="flex-1">
                        <p className={`font-bold text-xs ${highlight ? 'text-slate-900' : 'text-slate-500'}`}>{name}</p>
                        <div className="flex items-center gap-1 mt-0.5">
                          <Stars n={Math.round(stars)} />
                          <span className="text-[10px] text-slate-400">{stars} ({reviews} reviews)</span>
                        </div>
                      </div>
                      {highlight && (
                        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: GOLD_LIGHT, color: GOLD_DARK }}>
                          LocalReach
                        </span>
                      )}
                    </div>
                  ))}
                </div>
                <div className="flex-1 space-y-3">
                  <h3 className="text-2xl font-black text-slate-900">
                    More reviews = higher Google Maps ranking.
                  </h3>
                  <p className="text-slate-600 leading-relaxed">
                    Google&apos;s local search algorithm heavily weights review volume, recency, and keyword diversity.
                    LocalReach systematically addresses all three — giving your business a compounding ranking advantage
                    that grows with every customer interaction.
                  </p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {['Review Velocity', 'Keyword Diversity', 'Recency Signal', 'Spam-Free'].map((tag) => (
                      <span key={tag} className="text-[11px] font-bold px-3 py-1.5 rounded-full border"
                        style={{ borderColor: GOLD, color: GOLD_DARK, backgroundColor: GOLD_LIGHT }}>
                        ✓ {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Features ────────────────────────────────────────────── */}
        <section className="py-20 bg-slate-50">
          <div className="mx-auto max-w-6xl px-6">
            <div className="text-center mb-12">
              <SectionLabel>Core Capabilities</SectionLabel>
              <h2 className="text-4xl sm:text-5xl font-black text-slate-900">
                Three Engines. One Platform.
              </h2>
              <p className="mt-3 text-slate-500 text-base max-w-xl mx-auto">
                Each feature addresses a specific gap that generic review tools completely ignore.
              </p>
            </div>

            <div className="space-y-5">
              {FEATURES.map(({ icon, tag, title, bullets }, i) => (
                <div
                  key={tag}
                  className={`rounded-2xl border p-8 flex flex-col md:flex-row gap-8 items-start
                    hover:shadow-lg transition-all ${i % 2 === 0 ? 'bg-white border-gray-200' : 'bg-white border-gray-200'}`}
                >
                  <div className="shrink-0">
                    <div
                      className="w-20 h-20 rounded-2xl flex items-center justify-center text-4xl shadow-sm"
                      style={{ backgroundColor: GOLD_LIGHT }}
                    >
                      {icon}
                    </div>
                  </div>
                  <div className="flex-1 space-y-3">
                    <span className="inline-block text-[10px] font-black tracking-[0.2em] uppercase px-3 py-1 rounded-full"
                      style={{ backgroundColor: GOLD_LIGHT, color: GOLD_DARK }}>
                      {tag}
                    </span>
                    <h3 className="text-2xl font-black text-slate-900">{title}</h3>
                    <ul className="grid sm:grid-cols-2 gap-2">
                      {bullets.map((b) => (
                        <li key={b} className="flex items-start gap-2 text-sm text-slate-600">
                          <span className="shrink-0 font-bold mt-0.5" style={{ color: GOLD }}>✓</span>
                          <span>{b}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Safety & Compliance ─────────────────────────────────── */}
        <section id="compliance" className="py-20 bg-slate-950 text-white relative overflow-hidden">
          <div className="absolute inset-0"
            style={{ background: `radial-gradient(ellipse at 70% 50%, ${GOLD}12 0%, transparent 60%)` }} />

          <div className="relative mx-auto max-w-6xl px-6">
            <div className="grid lg:grid-cols-2 gap-12 items-start">

              {/* Left: Headline + pillar cards */}
              <div className="space-y-8">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-bold mb-4"
                    style={{ backgroundColor: `${GOLD}20`, color: GOLD }}>
                    🛡️ Built for Premium Brands
                  </div>
                  <SectionLabel>Safety &amp; Compliance</SectionLabel>
                  <h2 className="text-4xl sm:text-5xl font-black leading-tight">
                    100% Policy<br />
                    Compliant <span style={{ color: GOLD }}>&amp; Safe.</span>
                  </h2>
                  <p className="mt-4 text-slate-400 text-base leading-relaxed">
                    Not just effective — built to protect your Google Business Profile
                    as a permanent digital asset for your brand.
                  </p>
                </div>

                {[
                  { num: '01', title: 'Feedback-First Flow', body: 'The satisfaction survey framing is not a review solicitation — it\'s feedback collection. Fully within Google\'s Terms of Service.' },
                  { num: '02', title: 'Zero Spam Signals', body: 'AI-unique text means no two reviews share structure or phrasing. Google\'s duplicate-content detection never triggers.' },
                  { num: '03', title: 'Enterprise Protection', body: 'Designed for chains and luxury brands where a single policy violation could damage years of carefully built reputation.' },
                ].map(({ num, title, body }) => (
                  <div key={num} className="flex gap-5 items-start">
                    <span className="text-3xl font-black opacity-25 shrink-0 w-10 leading-none" style={{ color: GOLD }}>{num}</span>
                    <div>
                      <h4 className="text-base font-black text-white mb-1">{title}</h4>
                      <p className="text-sm text-slate-400 leading-relaxed">{body}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Right: Risk vs Solution cards */}
              <div className="space-y-4">
                {/* Risk card */}
                <div className="rounded-2xl border border-red-800/40 bg-red-950/30 p-6 space-y-4">
                  <div className="flex items-center gap-2">
                    <span className="text-red-400 font-black text-sm">⚠</span>
                    <p className="text-xs font-black tracking-widest uppercase text-red-400">What Other Tools Do</p>
                  </div>
                  <p className="text-sm text-slate-300 leading-relaxed">
                    Most low-cost tools pipe customers directly from a QR code to the Google review screen,
                    or incentivize reviews with discounts. Both{' '}
                    <strong className="text-red-300">violate Google&apos;s review policies</strong>{' '}
                    — with account suspension as the consequence.
                  </p>
                  <ul className="space-y-2">
                    {['Direct QR → review page (solicited reviews)', 'Discount or reward incentives', 'Identical template text → spam flag'].map(b => (
                      <li key={b} className="flex items-start gap-2 text-xs text-red-300">
                        <span className="shrink-0 font-bold">✗</span><span>{b}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Solution card */}
                <div className="rounded-2xl p-6 space-y-4"
                  style={{ backgroundColor: '#12110A', border: `1.5px solid ${GOLD}50` }}>
                  <div className="flex items-center gap-2">
                    <span style={{ color: GOLD }} className="font-black text-sm">✓</span>
                    <p className="text-xs font-black tracking-widest uppercase" style={{ color: GOLD }}>The LocalReach Approach</p>
                  </div>
                  <p className="text-sm text-slate-300 leading-relaxed">
                    LocalReach inserts a{' '}
                    <strong className="text-white">Customer Satisfaction Survey</strong> as a buffer
                    before the Google review screen. Feedback-first. No incentives. No direct ask.
                    Fully aligned with Google&apos;s guidelines.
                  </p>
                  <ul className="space-y-2">
                    {['Survey-first buffer page — not a direct review solicitation', 'AI-unique text — zero spam signals per submission', 'No incentive schemes — organic, authentic reviews only'].map(b => (
                      <li key={b} className="flex items-start gap-2 text-xs" style={{ color: GOLD_LIGHT }}>
                        <span className="shrink-0 font-bold" style={{ color: GOLD }}>✓</span><span>{b}</span>
                      </li>
                    ))}
                  </ul>

                  {/* Compliance badge */}
                  <div className="flex items-center gap-3 rounded-xl p-3 mt-2"
                    style={{ backgroundColor: `${GOLD}15`, border: `1px solid ${GOLD}30` }}>
                    <span className="text-2xl">🛡️</span>
                    <div>
                      <p className="text-xs font-black" style={{ color: GOLD }}>Google Review Policy · Section 3.4</p>
                      <p className="text-[11px] text-slate-400">
                        &quot;Don&apos;t discourage or prohibit negative reviews or selectively solicit positive reviews.&quot;
                        LocalReach collects all feedback — only satisfied customers choose to post.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Comparison Table ────────────────────────────────────── */}
        <section className="py-20 bg-white">
          <div className="mx-auto max-w-6xl px-6">
            <div className="text-center mb-12">
              <SectionLabel>Competitive Analysis</SectionLabel>
              <h2 className="text-4xl sm:text-5xl font-black text-slate-900">
                Why LocalReach Wins.
              </h2>
              <p className="mt-3 text-slate-500 text-base">
                The only solution combining AI uniqueness, passive CRM, and full Google policy compliance.
              </p>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-gray-200 shadow-md">
              <table className="w-full text-sm min-w-[640px]">
                <thead>
                  <tr>
                    <th className="text-left px-6 py-5 text-xs font-bold uppercase tracking-wider text-slate-500 bg-slate-50 border-b border-gray-200">
                      Feature
                    </th>
                    <th className="px-6 py-5 text-xs font-bold uppercase tracking-wider text-center border-b"
                      style={{ backgroundColor: GOLD_LIGHT, color: GOLD_DARK, borderColor: `${GOLD}40` }}>
                      LocalReach
                    </th>
                    <th className="px-6 py-5 text-xs font-bold uppercase tracking-wider text-center text-slate-500 bg-slate-50 border-b border-gray-200">
                      Generic Tools
                    </th>
                    <th className="px-6 py-5 text-xs font-bold uppercase tracking-wider text-center text-slate-500 bg-slate-50 border-b border-gray-200">
                      Handwritten POP
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {COMPARISON_ROWS.map(({ feature, lr, gen, pop }) => (
                    <tr key={feature} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 font-semibold text-slate-700">{feature}</td>
                      <td className="px-6 py-4 text-center text-xs font-black"
                        style={{ color: GOLD_DARK, backgroundColor: `${GOLD_LIGHT}50` }}>
                        {lr}
                      </td>
                      <td className={`px-6 py-4 text-center text-xs font-semibold ${gen.startsWith('✗') ? 'text-red-400' : 'text-slate-500'}`}>
                        {gen}
                      </td>
                      <td className={`px-6 py-4 text-center text-xs font-semibold ${pop === '✗' ? 'text-red-400' : 'text-slate-400'}`}>
                        {pop}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* ── CTA ─────────────────────────────────────────────────── */}
        <section id="book-demo" className="py-24 hero-bg text-white text-center relative overflow-hidden">
          <div className="absolute inset-0 grid-dots opacity-40" />
          <div className="absolute inset-0"
            style={{ background: `radial-gradient(ellipse at 50% 40%, ${GOLD}18 0%, transparent 65%)` }} />

          <div className="relative mx-auto max-w-2xl px-6 space-y-8">
            <div className="text-6xl">🚀</div>
            <h2 className="text-4xl sm:text-5xl font-black leading-tight">
              Ready to Dominate<br />
              <span className="shimmer-gold">Your Local Market?</span>
            </h2>
            <p className="text-slate-400 text-lg leading-relaxed max-w-lg mx-auto">
              Join forward-thinking Dubai businesses already using LocalReach
              to build reviews, grow their CRM, and climb Google Maps rankings.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href="mailto:info@gam-solutions.com?subject=LocalReach%20Demo%20Request"
                className="inline-flex items-center justify-center gap-3 rounded-2xl px-10 py-5
                  text-base font-black text-white shadow-2xl hover:opacity-90 active:scale-[0.97] transition-all"
                style={{ backgroundColor: GOLD }}
              >
                📅 Book a Free Demo
              </a>
            </div>
            <p className="text-xs text-slate-600">
              No commitment · 30-min live walkthrough · Includes Q&amp;A · Available in EN / JA / AR
            </p>

            {/* Trust badges */}
            <div className="flex flex-wrap justify-center gap-4 pt-4">
              {['Google Policy Compliant', 'Dubai Market Expert', 'Multi-language Ready', 'Zero Setup Fee'].map((b) => (
                <span key={b} className="text-[11px] font-semibold border border-white/15 rounded-full px-3 py-1.5 text-slate-400">
                  ✓ {b}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* ── Footer ──────────────────────────────────────────────── */}
        <footer className="bg-black py-8">
          <div className="mx-auto max-w-6xl px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-black text-white">Local</span>
              <span className="text-sm font-black" style={{ color: GOLD }}>Reach</span>
              <span className="text-[10px] text-slate-600 ml-2">by GAM Solutions · Dubai</span>
            </div>
            <p className="text-[10px] text-slate-700 tracking-widest uppercase">
              AI-Powered Local SEO · GEO Optimization · WhatsApp CRM
            </p>
          </div>
        </footer>

      </div>
    </>
  )
}
