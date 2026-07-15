import { generateReply } from '@/lib/reply-engine'

const KW = ['best doughnuts in Dubai', 'artisan bakery Dubai Marina']
const opts = (rating, locale) => ({
  rating, reviewText: '', locale, tone: 'warm',
  geoPhrase: 'Dubai Marina', weaveGeo: true, geoKeywords: KW, signature: '',
})

// Phrases that would be a lie under a silent rating (guest wrote nothing).
const LIES_EN = [/kind words/i, /for (writing|the review|your review)/i, /taking the time to (write|say)/i,
  /you (said|described|mentioned|wrote)/i, /reads?/i, /this review/i, /your (words|comments|feedback|note)/i,
  // Claims about what the guest made of the visit are inventions too, not just claims about their words.
  /you (noticed|enjoyed|loved|liked|felt|caught)/i]
const LIES_JA = [/お言葉/, /レビューを?(書|あり)/, /ご感想/, /書いてくだ/, /拝読/, /コメントを?あり/]

let fail = 0
const check = (label, cond, sample) => {
  if (!cond) { fail++; console.log(`FAIL ${label}\n  ${sample.replace(/\n+/g, ' / ')}`) }
}

for (const locale of ['en', 'ja', 'ar']) {
  for (const rating of [5, 4, 3, 2, 1]) {
    const lies = locale === 'en' ? LIES_EN : locale === 'ja' ? LIES_JA : []
    for (let i = 0; i < 300; i++) {
      const out = generateReply('Let it dough', { ...opts(rating, locale), nonce: `n${i}` })
      check(`${locale}/${rating}★ invents written feedback`, !lies.some((re) => re.test(out)), out)
      check(`${locale}/${rating}★ empty`, out.trim().length > 20, out)
      // Marketing keyword must never appear on a silent 3-star or an apology.
      if (rating <= 3) check(`${locale}/${rating}★ leaked keyword`, !KW.some((k) => out.includes(k)), out)
      // Low ratings must ask, not guess.
      if (rating <= 3 && locale === 'en') {
        check(`${locale}/${rating}★ no ask`, /tell us|let us know|get in touch|reach out|share|hear|know what|would have made|a line about|all ears|one sentence|would help us|welcome a line/i.test(out), out)
      }
    }
  }
}
// Positive rating-only should still carry the SEO signal (only indexable text there).
let geoHits = 0, kwHits = 0
for (let i = 0; i < 300; i++) {
  const out = generateReply('Let it dough', { ...opts(5, 'en'), nonce: `s${i}` })
  if (out.includes('Dubai Marina')) geoHits++
  if (KW.some((k) => out.includes(k))) kwHits++
}
console.log(`5★ rating-only: geo ${geoHits}/300, keyword ${kwHits}/300`)
check('5★ geo signal too weak', geoHits > 150, '')
check('5★ keyword signal too weak', kwHits > 100, '')

console.log(fail === 0 ? '\nALL PASS' : `\n${fail} FAILURES`)
process.exit(fail ? 1 : 0)
