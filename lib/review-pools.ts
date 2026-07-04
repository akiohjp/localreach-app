/**
 * Review phrase pools, keyed by locale (en/ja) and business vertical.
 *
 * GENERIC pools are industry-neutral (no food nouns) so they read naturally for
 * ANY local business. Vertical pools add category flavour and are merged on top
 * of GENERIC (concatenated) by resolvePoolSet.
 *
 * Placeholders: {store} {list} {a} {b} {kw}. Guest voice, first person, no
 * typographic long dashes, no SEO/AIO/marketing jargon.
 */

export type ReviewLocale = "en" | "ja";
export type Vertical =
  | "generic"
  | "restaurant"
  | "cafe"
  | "beauty"
  | "aesthetic"
  | "dental"
  | "clinic"
  | "retail"
  | "fitness"
  | "hotel"
  | "auto"
  | "realestate"
  | "legal"
  | "home"
  | "education"
  | "pet"
  | "services";

export type PoolSet = {
  openersLong: string[];
  openersShort: string[];
  coresLong: string[];
  coresCompact: string[];
  dualBlocks: string[];
  bridgesLong: string[];
  bridgesShort: string[];
  closersLong: string[];
  closersShort: string[];
  fillers: string[];
  tails: string[];
  microOpeners: string[];
  noKeywordMid: string[];
};

const EMPTY: PoolSet = {
  openersLong: [], openersShort: [], coresLong: [], coresCompact: [], dualBlocks: [],
  bridgesLong: [], bridgesShort: [], closersLong: [], closersShort: [], fillers: [],
  tails: [], microOpeners: [], noKeywordMid: [],
};

/**
 * Map a free-text store business_category to a canonical vertical.
 *
 * Order matters: it returns on the first hit, so specific high-value verticals
 * are checked before the broad fallbacks (clinic / beauty / retail / fitness /
 * services). E.g. dental & pet & aesthetic are matched before clinic/beauty
 * because their keywords overlap; realestate / home / education are matched
 * before retail because "shop/store/店" is greedy.
 */
export function resolveVertical(category: string | null | undefined): Vertical {
  const c = (category ?? "").toLowerCase();
  if (!c) return "generic";
  // --- food ---
  if (/restaurant|dining|food|sushi|ramen|izakaya|grill|bbq|steak|bistro|eatery|kitchen|飲食|レストラン|居酒屋|食堂/.test(c)) return "restaurant";
  if (/cafe|coffee|tea|bakery|dessert|patisserie|カフェ|喫茶|ベーカリー/.test(c)) return "cafe";
  // --- medical / body (specific before generic clinic & beauty) ---
  if (/dental|dentist|orthodont|endodont|implant|歯科|矯正歯科|インプラント|歯医者/.test(c)) return "dental";
  if (/pet|veterinar|\bvet\b|grooming|groomer|kennel|cattery|動物病院|ペット|トリミング|獣医|ペットサロン/.test(c)) return "pet";
  if (/aesthetic|dermatolog|derma|cosmetic clinic|cosmetic surgery|medspa|med spa|medical spa|botox|filler|laser|slimming|weight loss|hifu|美容皮膚科|美容外科|医療美容|美容クリニック|医療脱毛|脱毛|痩身/.test(c)) return "aesthetic";
  if (/salon|beauty|spa|nail|hair|barber|lash|brow|美容室|美容院|ネイル|エステ|理容|サロン|まつげ|眉/.test(c)) return "beauty";
  if (/clinic|medical|hospital|doctor|pharmacy|therapy|chiro|physio|osteopath|クリニック|医院|病院|治療|整体|接骨|整骨|内科|耳鼻/.test(c)) return "clinic";
  // --- high-value professional / property / trades ---
  if (/real ?estate|realty|realtor|property|properties|broker|brokerage|leasing|letting|不動産|賃貸|物件|仲介|マンション|土地/.test(c)) return "realestate";
  if (/\blaw\b|legal|lawyer|attorney|solicitor|barrister|notary|accounting|accountant|bookkeep|\btax\b|audit|consultanc|consulting|advisory|法律|弁護士|会計|税理士|行政書士|司法書士|社労士|コンサル|事務所/.test(c)) return "legal";
  if (/renovation|remodel|interior|fit ?out|joinery|contractor|handyman|plumb|electric|carpentr|painting|flooring|landscap|construction|builder|リフォーム|内装|工務店|リノベ|設備|外構|塗装|大工|建築/.test(c)) return "home";
  if (/school|academy|tutor|tutoring|lesson|course|nursery|kindergarten|preschool|training cent|driving school|語学|塾|スクール|教室|予備校|習い事|英会話|保育|幼稚園|学習/.test(c)) return "education";
  // --- broad fallbacks ---
  // hotel before retail so "boutique hotel" isn't swallowed by retail's "boutique".
  if (/hotel|\binn\b|motel|resort|hostel|accommodation|lodging|ホテル|旅館|宿|民宿/.test(c)) return "hotel";
  // "\bmarket\b/supermarket" (not "marketing"); a marketing agency should stay "services".
  if (/shop|store|retail|boutique|supermarket|\bmarket\b|grocery|apparel|florist|店|ショップ|小売|雑貨/.test(c)) return "retail";
  if (/gym|fitness|yoga|pilates|studio|crossfit|personal training|ジム|フィットネス|ヨガ|トレーニング|ピラティス/.test(c)) return "fitness";
  if (/auto|car|mechanic|garage|tyre|tire|body shop|detailing|自動車|整備|車|カー/.test(c)) return "auto";
  return "services";
}

function mergePool(base: PoolSet, over: Partial<PoolSet>): PoolSet {
  const out = { ...EMPTY } as PoolSet;
  (Object.keys(EMPTY) as (keyof PoolSet)[]).forEach((k) => {
    out[k] = [...base[k], ...(over[k] ?? [])];
  });
  return out;
}

// =========================================================== EN · GENERIC ===
const EN_GENERIC: PoolSet = {
  openersLong: [
    "Stopped by {store} recently and figured I'd jot down what stood out. Nothing fancy, just the parts that would matter if a friend asked.",
    "Had been meaning to try {store} for a while, and the visit didn't feel overhyped on our end. A few things are still clear in my head the next day.",
    "First visit to {store} went better than I expected, and I'd come back without overthinking it.",
    "Not here to write an essay. {store} surprised me in a few specific ways, which is why I'm leaving this.",
    "Came into {store} with normal expectations and left with a short list of positives I didn't think I'd still be thinking about later.",
    "If someone asked me about {store} over coffee, here's the honest version: a couple of moments were memorable, the overall line is positive.",
    "Posting this because {store} got a few details right that I don't want to flatten into a star rating alone.",
    "Straight talk: {store} wasn't trying to reinvent anything, which I liked. Competence mattered more than flash.",
    "Went to {store} on a busy day and half-expected chaos, but the execution was steadier than I'm used to.",
    "{store} piled up quiet wins across the visit, the kind of small things that rarely line up at once.",
    "A friend kept telling me to check out {store}, and after finally going I get why they wouldn't drop it.",
    "I don't hand out reviews for everywhere I go, but {store} did enough right that it felt worth the two minutes.",
    "Ended up at {store} almost by accident, and it turned into one of those visits I keep bringing up.",
    "Walked into {store} with zero expectations, which is usually a recipe for disappointment, and instead came away impressed.",
    "Been to plenty of places that talk a big game; {store} just quietly did the job and let that speak.",
    "What I noticed at {store} wasn't one big thing, more a bunch of small ones that added up by the time I left.",
    "Wrote this the same evening because the details from {store} were still sharp and I didn't want to round them off.",
    "{store} is the sort of local spot you end up defending to friends who haven't tried it yet.",
  ],
  openersShort: [
    "Quick take on {store}: overall a good visit, and a couple of specifics are worth mentioning.",
    "Stopped by {store} not long ago, and the highs were clear enough that I still remember them.",
    "{store} wasn't flawless for us, but the good bits below are real enough that I'd return.",
    "{store}? Yeah, I'd do that again.",
    "Short version: {store} delivered where it counted.",
    "Posting while it's fresh. {store} had a handful of standout moments.",
    "{store}: not loud marketing energy, just a solid experience.",
    "Honestly {store} is on my revisit list already, which is unusual for a first visit.",
    "Quick one for {store}: did what I hoped, no notes worth dwelling on.",
    "{store} earned the write-up, and I'm stingy with those.",
    "Two words for {store}: pleasantly surprised.",
    "{store} handled the day well; I'd send someone here without a caveat.",
    "Left {store} in a good mood, which tells you most of what you need.",
  ],
  coresLong: [
    "What stood out most was {list}. At {store} that wasn't just wording, and you could tell someone cared about getting it right.",
    "If I had to describe the visit in a handful of phrases, I'd pick {list}. {store} kept that thread from start to finish.",
    "The things I'd repeat to a coworker or neighbour are {list}, specific enough that I'm not reaching for generic praise.",
    "The backbone of what I liked ties back to {list}. {store} didn't phone that in.",
    "If you strip it down, the visit was basically {list} done with attention, and that's the story at {store}.",
    "Standouts for me were {list}. {store} didn't treat those like an afterthought.",
    "What I'd steer people toward is {list}, and {store} actually delivered on those.",
    "{list} is the honest shorthand for why I'd recommend {store} without sugarcoating.",
    "Ask me what to expect from {store} and I'd point straight at {list}, no hedging.",
    "The parts that actually stuck with me were {list}, and {store} kept them consistent the whole way through.",
    "For me it came down to {list}, and that's the part of {store} I'd tell a friend not to miss.",
    "I keep coming back to {list} when I think about the visit; {store} nailed those specifically.",
    "Cut the fluff and it's {list} that made {store} worth the trip.",
  ],
  coresCompact: [
    "What worked: {list}.",
    "{store} really showed up on {list}.",
    "I'd call out {list} as what made the visit memorable.",
    "Bright spots: {list}.",
    "{store}: {list}. Enough said.",
    "Short list from {store}: {list}.",
    "If you go, notice {list}.",
    "{store} won me over on {list}.",
  ],
  dualBlocks: [
    "One thread through the visit was {a}; separately, {b} also landed at {store} without feeling bolted on.",
    "{a} showed up first for me; later {b} rounded it out, and both felt deliberate at {store}.",
    "I'll split it: {a} framed the start, {b} finished the impression, and it felt cohesive at {store}.",
    "Aside from the general vibe, what's concrete is {a} alongside {b} at {store}.",
  ],
  bridgesLong: [
    "The staff at {store} matched the rest of it: helpful when I needed something, not hovering the rest of the time.",
    "The place was comfortable, and the pacing felt right, not rushed and not dragging.",
    "What I paid felt fair for what I got; nobody had that \"were we overcharged\" moment.",
    "They handled a small change without any friction, and that's the kind of thing people remember.",
    "{store} read the situation correctly, upbeat when it suited and low-key when it didn't.",
    "Nobody made me chase anything down; whatever I needed at {store} got sorted quickly.",
    "It's clean and well kept, the kind of upkeep you only notice when it's missing somewhere else.",
    "First impression at {store} held up, which matters more than a strong start that fizzles.",
    "They were honest about timing instead of overpromising, and it played out exactly as they said.",
  ],
  bridgesShort: [
    "Front of house at {store} was in step with everything else.",
    "Nothing felt slapdash. {store} had its act together.",
    "{store} kept things moving without making me clock-watch.",
    "The space was easy to settle into, no awkward shuffle.",
    "Small stuff was handled at {store}, and small stuff adds up.",
    "{store} clearly sweats the details most places skip.",
  ],
  closersLong: [
    "I'd go back to {store} without overthinking it, and the stuff above is what I'd tell someone choosing this week.",
    "Happy to recommend {store}: fair for what I got, and the visit felt easy from start to finish.",
    "Bottom line: {store} did the important parts well, and if my experience is typical it's a solid pick.",
    "I'll put {store} in the rotation; not every place earns that after one visit.",
    "{store} is the kind of place I'd send people who complain that reviews all sound fake, because my visit felt grounded.",
    "If the rest of the team is anything like who I dealt with, {store} is a safe bet.",
    "I'll keep it simple: {store} did right by me, and I'd tell a friend the same.",
    "Would I come back to {store}? Already planning on it.",
    "For what it's worth, {store} is now my default recommendation when this comes up.",
  ],
  closersShort: [
    "{store} gets a yes from me; I'll be back.",
    "I'd send people to {store}; it was worth the time.",
    "No drama: {store} was simply good.",
    "Skip the overthinking and try {store}.",
    "Solid all round. {store} earned it.",
    "Would go back to {store} tomorrow.",
    "{store}: recommend without the asterisk.",
  ],
  fillers: [
    "That steady quality is a big part of why I'd pick {store} again over rolling the dice somewhere new.",
    "Walking out of {store}, I already knew I'd be back, and that's usually a good sign.",
    "It's rare that I leave {store} without a single nitpick, and this time the nits were small.",
    "{store} felt like a place that wants repeat locals, not one-and-done visitors.",
    "I'd rather under-promise on {store} and have a friend be pleasantly surprised.",
    "There's a difference between a place that's fine and one you'd actively suggest; {store} lands in the second bucket for me.",
    "Consistency is underrated until you don't get it, and {store} had it the whole visit.",
  ],
  tails: [
    "{kw} was a highlight for me.",
    "They came through on {kw}.",
    "No complaints on {kw}.",
    "{kw} felt genuine, not bolted on.",
    "I'd point to {kw} if someone asked what to expect.",
    "{kw} didn't get lost in the shuffle.",
    "{kw} is worth the trip on its own.",
    "Give {kw} a look while you're there.",
    "{kw} lived up to what I'd heard.",
  ],
  microOpeners: [
    "Jotting this down before I forget.",
    "Not a fancy review, just a real note.",
    "Keeping this short on purpose.",
  ],
  noKeywordMid: [
    "The visit ran smoothly, and I'd still name {store} as a place I'd go back to for the service and the overall feel alone.",
    "Nothing dramatic to report, which is the point: {store} just did the basics well and made it easy.",
  ],
};

// =========================================================== JA · GENERIC ===
const JA_GENERIC: PoolSet = {
  openersLong: [
    "先日{store}を利用しました。印象に残った点を、友人に聞かれたら答える感じで書いておきます。",
    "前から気になっていた{store}に行ってきました。期待しすぎず伺いましたが、翌日まで覚えている良さがいくつかありました。",
    "{store}は初めての利用でしたが、思っていたより良くて、また来たいと素直に思えました。",
    "長い感想を書くつもりはないのですが、{store}は具体的に良い点がいくつかあったので残しておきます。",
    "普通の期待値で{store}に伺い、あとから思い返しても良かった点がいくつも出てきました。",
    "正直に言うと、{store}は派手さで勝負していない印象で、そこが逆に好感でした。",
    "混んでいる時間に{store}を利用しましたが、対応が思っていたより落ち着いていて安心しました。",
    "星の数だけでは伝わらない良さがあったので、{store}についてメモしておきます。",
    "友人にずっと勧められていた{store}にようやく行きましたが、勧めてくる理由が分かりました。",
    "行く先々でレビューを書くタイプではないのですが、{store}は書く価値を感じる点がいくつもありました。",
    "たまたま立ち寄った{store}でしたが、あとから何度も話題に出すくらい印象に残りました。",
    "大きな特徴が一つというより、小さな良さが積み重なって、帰る頃には満足していました。それが{store}でした。",
    "記憶が鮮明なうちにと思い、その日のうちに{store}の感想を書いています。",
    "口コミは話半分で見る方ですが、{store}は実際に行って納得できる内容でした。",
  ],
  openersShort: [
    "{store}に行ってきました。全体的に良い時間で、いくつか具体的に触れておきます。",
    "先日{store}を利用。良かった点がはっきりしていて、今でも覚えています。",
    "{store}は完璧とまでは言いませんが、良かった部分は本物で、また利用したいです。",
    "{store}、また利用すると思います。",
    "手短に言うと、{store}は肝心なところがしっかりしていました。",
    "記憶が新しいうちに。{store}には印象的な瞬間がいくつかありました。",
    "{store}、期待以上でした。細かい注文は特にありません。",
    "気持ちよく過ごせて、{store}なら人にも紹介できます。",
    "手短に言えば、{store}は行って良かったです。",
    "{store}を出るとき機嫌が良かった、それがほぼ全てを物語っています。",
  ],
  coresLong: [
    "特に良かったのは{list}でした。{store}ではそこが言葉だけでなく、きちんと気を配っているのが伝わりました。",
    "今回の利用を一言でまとめるなら{list}です。{store}は最初から最後までその印象が続きました。",
    "同僚や近所の人に伝えたくなるのは{list}で、ありきたりな褒め言葉ではない具体性がありました。",
    "良かった点の軸は{list}に集約されます。{store}はそこを手を抜かずやっていました。",
    "要するに{list}が丁寧に揃っていて、それが{store}の良さだと思います。",
    "自分にとっての決め手は{list}で、{store}はそこをしっかり形にしていました。",
    "何を期待できるか聞かれたら、迷わず{list}と答えます。{store}はそこがぶれませんでした。",
    "あとから思い返しても残るのは{list}で、{store}は最初から最後まで一貫していました。",
    "自分の中で決め手になったのは{list}で、友人にも「そこは外さないで」と伝えたい部分です。",
    "余計なものを削ぎ落とすと、{store}を勧める理由は{list}に尽きます。",
  ],
  coresCompact: [
    "良かった点は{list}です。",
    "{store}は{list}がしっかりしていました。",
    "印象に残ったのは{list}でした。",
    "特筆すべきは{list}です。",
    "{store}、{list}。以上です。",
    "{store}の推しどころは{list}です。",
    "行くなら{list}に注目してみてください。",
  ],
  dualBlocks: [
    "まず{a}が良く、加えて{b}も{store}でしっかりしていて、取ってつけた感がありませんでした。",
    "最初に{a}が印象に残り、後から{b}が全体をまとめてくれて、どちらも{store}で意図を感じました。",
    "分けて言うと、{a}が入りを作り、{b}が締めになって、{store}として一貫していました。",
    "雰囲気は別として、具体的に良かったのは{a}と{b}で、{store}はその両方を押さえていました。",
  ],
  bridgesLong: [
    "スタッフの対応も全体と揃っていて、{store}は必要なときにきちんと動き、そうでないときは過度に構いすぎませんでした。",
    "空間も居心地がよく、急かされず、待たされすぎもしない、ちょうど良いテンポでした。",
    "支払った金額も内容に見合っていて、割高だと感じる瞬間はありませんでした。",
    "ちょっとした変更にもスムーズに応じてくれて、こういう小さな点は記憶に残ります。",
    "{store}は場の空気をきちんと読んでいて、賑やかにしたい時は明るく、落ち着きたい時は静かでした。",
    "こちらから何かを催促する必要がなく、必要なことは{store}がすぐに対応してくれました。",
    "清潔感があり、こういう行き届いた感じは、無い店に行った時に初めて気づくものだと思います。",
    "できないことは正直に伝えてくれて、言われた通りの流れで進んだので安心でした。",
  ],
  bridgesShort: [
    "{store}は接客と全体の流れが噛み合っていました。",
    "雑な部分がなく、{store}はしっかりしていました。",
    "{store}は時間を気にさせずテンポよく進めてくれました。",
    "空間になじみやすく、ぎこちなさがありませんでした。",
    "細かいところまで行き届いていて、{store}はそこが違いました。",
    "小さな気配りの積み重ねが、{store}の印象を良くしていました。",
  ],
  closersLong: [
    "また{store}を利用したいと思います。上に書いた点が、今週どこにしようか迷う人に伝えたい内容です。",
    "{store}は素直におすすめできます。内容に対して妥当で、入店から退店まで気持ちよく過ごせました。",
    "結論として、{store}は肝心なところをきちんと押さえていて、今回が標準的なら十分に良い選択だと思います。",
    "{store}は自分の中の候補に加えます。一度の利用でそう思える店は多くありません。",
    "レビューは当てにならないと言う人にこそ勧めたい、{store}はそう思える利用でした。",
    "対応してくれた方がこの調子なら、{store}は安心して勧められます。",
    "難しいことは抜きにして、{store}は自分にきちんと応えてくれました。友人にも同じように伝えます。",
    "また{store}に来るかと聞かれたら、もう次を考えています。",
  ],
  closersShort: [
    "{store}はおすすめです。また伺います。",
    "人に勧めたくなる、{store}はそんなお店でした。",
    "余計なことは抜きに、{store}は普通に良かったです。",
    "迷うなら{store}を試してみてください。",
    "総じて良かったです。{store}は期待に応えてくれました。",
    "また明日にでも{store}に行きたいくらいです。",
    "条件なしでおすすめできます、{store}は。",
  ],
  fillers: [
    "この安定感があるので、新しい所で外すより次回も{store}を選ぶと思います。",
    "{store}を出るときには、また来ようと自然に思えました。良い兆候だと思います。",
    "{store}で全く不満なく終わることは珍しく、今回は気になる点もごく小さなものでした。",
    "{store}は一度きりの客より、通ってくれる地元客を大事にしている雰囲気でした。",
    "普通に良い店と、人に勧めたくなる店は別物ですが、{store}は後者でした。",
    "安定していることのありがたさは失って初めて分かりますが、{store}は最後までそれがありました。",
  ],
  tails: [
    "{kw}も良かったです。",
    "{kw}はきちんと応えてくれました。",
    "{kw}に不満はありません。",
    "{kw}は取ってつけた感がなく自然でした。",
    "何を期待できるか聞かれたら{kw}を挙げます。",
    "{kw}だけでも行く価値があります。",
    "{kw}は評判どおりでした。",
    "行くなら{kw}もぜひ。",
  ],
  microOpeners: [
    "忘れないうちに書いておきます。",
    "きちんとしたレビューではなく、素直なメモです。",
    "あえて手短に。",
  ],
  noKeywordMid: [
    "全体的に気持ちよく利用でき、{store}は対応や雰囲気だけでも十分におすすめできると思います。",
    "特筆すべき問題もなく、そこが良い点で、{store}は基本をきちんと押さえて楽に過ごさせてくれました。",
  ],
};

// ====================================================== VERTICAL FLAVOURS ===
// Only the category-flavoured slots; the rest is inherited from GENERIC.

const EN_VERTICAL: Partial<Record<Vertical, Partial<PoolSet>>> = {
  restaurant: {
    openersLong: [
      "We ate at {store} recently and I figured I'd jot down what stuck with us at the table.",
      "Dinner at {store} was the kind of meal where you walk out and actually want to say something online.",
    ],
    openersShort: ["{store}? Yeah, we'd eat there again.", "Quick take after {store}: a good meal, with a couple of standout plates."],
    coresLong: [
      "What landed best was {list}. At {store} that came through from the first bite to the last.",
      "If you strip the meal down, it was basically {list} done with care, and that's {store}.",
    ],
    bridgesLong: ["The bill felt fair relative to the portions, and service kept pace with the kitchen at {store}."],
    closersLong: ["I'd go back to {store} hungry again without overthinking it."],
  },
  cafe: {
    openersLong: ["Grabbed a coffee at {store} and ended up staying longer than planned, which says something."],
    openersShort: ["{store} is a solid spot to sit and slow down for a bit."],
    coresLong: ["The little things did it for me: {list}. {store} clearly cares about the details."],
    closersLong: ["I'll be back to {store} next time I want somewhere calm to sit."],
  },
  beauty: {
    openersLong: [
      "Went to {store} for an appointment and left happier with the result than I expected.",
      "Booked in at {store} a bit nervous about a new place, and I'm glad I did.",
    ],
    openersShort: ["{store} did a great job; I'd book again."],
    coresLong: ["What made the difference was {list}. At {store} it felt like they actually listened to what I wanted."],
    bridgesLong: ["They talked me through everything at {store}, so I never felt rushed into a decision."],
    closersLong: ["I've already thought about my next appointment at {store}, which is unusual for me."],
  },
  clinic: {
    openersLong: [
      "Visited {store} for an appointment and the whole thing was calmer and clearer than I'm used to.",
      "Came into {store} not sure what to expect and left reassured.",
    ],
    openersShort: ["{store} was professional and put me at ease."],
    coresLong: ["What stood out was {list}. At {store} things were explained properly, without being rushed."],
    bridgesLong: ["The staff at {store} were patient and answered questions without making me feel like a number."],
    closersLong: ["I'd trust {store} again and would point family here."],
  },
  retail: {
    openersLong: ["Shopped at {store} recently and the visit was easier and friendlier than I expected."],
    openersShort: ["{store} is worth a look; I found what I needed and then some."],
    coresLong: ["What made it work was {list}. {store} made the whole thing simple."],
    closersLong: ["I'll shop at {store} again next time I'm nearby."],
  },
  fitness: {
    openersLong: ["Trained at {store} and it had the right energy without any of the intimidating gym cliches."],
    openersShort: ["{store} is a solid place to actually get a session in."],
    coresLong: ["What kept me coming back was {list}. {store} makes it easy to show up."],
    closersLong: ["I'd recommend {store} to anyone looking for a place that doesn't overcomplicate it."],
  },
  dental: {
    openersLong: [
      "Went to {store} for a check-up half-expecting the usual dread, and the whole appointment was calmer than that.",
      "Switched to {store} after a bad run elsewhere, and the difference was obvious from the first visit.",
    ],
    openersShort: ["{store} made a dental visit genuinely painless; I'd book again."],
    coresLong: [
      "What set it apart was {list}. At {store} everything got explained before anything happened, so I wasn't guessing.",
      "The part that mattered to me was {list}. {store} took the time to get it right instead of rushing me through.",
    ],
    bridgesLong: ["They walked me through the options and the costs up front at {store}, so there were no surprises after."],
    closersLong: ["I'd trust {store} with my family's teeth, and that's not something I say lightly about a clinic."],
  },
  aesthetic: {
    openersLong: [
      "Booked a treatment at {store} a little nervous about looking overdone, and left glad I picked somewhere careful.",
      "Went to {store} for a consultation and appreciated that nobody tried to upsell me on things I didn't need.",
    ],
    openersShort: ["{store} gave me natural results and honest advice; I'd go back."],
    coresLong: [
      "What made the difference was {list}. At {store} the results looked like me, just better, not like a different face.",
      "The thing I'd highlight is {list}. {store} clearly prioritises doing it safely over doing it fast.",
    ],
    bridgesLong: ["The consultation at {store} was thorough and hygiene was visibly taken seriously, which put me at ease."],
    closersLong: ["I've already thought about my next visit to {store}, and I'd point friends here over the flashier places."],
  },
  realestate: {
    openersLong: [
      "Worked with {store} on a move I'd been dreading, and they made the whole thing far less stressful than I expected.",
      "Dealt with {store} to find a place, and unlike a few agents I'd met, they actually listened to what I was after.",
    ],
    openersShort: ["{store} made the property side of things straightforward; genuinely helpful."],
    coresLong: [
      "What stood out was {list}. With {store} I never felt pushed toward something that suited them more than me.",
      "The part I'd flag is {list}. {store} was straight with me about the market instead of just chasing a deal.",
    ],
    bridgesLong: ["They stayed responsive through the paperwork and handover at {store}, which is exactly when most agents go quiet."],
    closersLong: ["I'd go back to {store} for the next move and happily pass their name to anyone house-hunting."],
  },
  legal: {
    openersLong: [
      "Went to {store} for advice I'd been putting off, and they made a stressful situation feel manageable.",
      "Reached out to {store} expecting to be talked over in jargon, and instead got answers I could actually follow.",
    ],
    openersShort: ["{store} was clear, responsive and worth it; I'd use them again."],
    coresLong: [
      "What I valued was {list}. At {store} they explained my options in plain terms and let me decide without pressure.",
      "The thing that stood out was {list}. {store} was upfront about the fees and the timeline from the start.",
    ],
    bridgesLong: ["They replied when they said they would and kept me updated at {store}, which is rarer than it should be."],
    closersLong: ["I'd go back to {store} without hesitation and have already recommended them to a colleague."],
  },
  home: {
    openersLong: [
      "Had {store} handle a job at home I'd been nervous about, and they turned it around cleaner than I'd hoped.",
      "Got a few quotes and went with {store}; the finished work made it clear that was the right call.",
    ],
    openersShort: ["{store} did tidy, on-time work and stuck to the quote; no complaints."],
    coresLong: [
      "What sold me was {list}. At {store} the final bill matched the quote and the finish held up to a close look.",
      "The part worth mentioning is {list}. {store} kept the site tidy and did what they said they would, when they said.",
    ],
    bridgesLong: ["They turned up when scheduled and cleaned up properly at {store}, which honestly can't be taken for granted."],
    closersLong: ["I'd have {store} back for the next project and I've already passed their number to a neighbour."],
  },
  education: {
    openersLong: [
      "Signed up at {store} not sure it'd stick, and it's turned into something I actually look forward to.",
      "Started lessons at {store} for the family, and the progress showed up faster than any of us expected.",
    ],
    openersShort: ["{store} makes learning feel doable; genuinely glad we started."],
    coresLong: [
      "What made it work was {list}. At {store} the teaching met me where I was instead of a one-size-fits-all script.",
      "The thing I'd point to is {list}. {store} keeps it encouraging without dumbing anything down.",
    ],
    bridgesLong: ["They kept us in the loop on progress at {store} and never pushed extras we didn't need."],
    closersLong: ["I'd recommend {store} to anyone on the fence; sticking with it here has been worth it."],
  },
  pet: {
    openersLong: [
      "Brought my dog to {store} a bit anxious, and they were gentle and patient in a way that put us both at ease.",
      "Took our cat to {store} for the first time, and the care and honesty made it an easy place to go back to.",
    ],
    openersShort: ["{store} treated my pet kindly and explained everything; I'd return."],
    coresLong: [
      "What stood out was {list}. At {store} they handled my pet with real care and never rushed us.",
      "The part I'd highlight is {list}. {store} was honest about what was needed rather than piling on extras.",
    ],
    bridgesLong: ["They talked me through everything clearly at {store}, and my pet was visibly calmer than at the last place."],
    closersLong: ["I'd trust {store} with my pet again and have already told other owners about them."],
  },
  hotel: {
    openersLong: [
      "Stayed at {store} for a few nights and it quietly got the important things right without any fuss.",
      "Booked {store} not knowing what to expect, and it turned out to be an easy, comfortable stay.",
    ],
    openersShort: ["{store} was a comfortable, hassle-free stay; I'd book it again."],
    coresLong: [
      "What made the stay was {list}. At {store} it was the details that added up rather than one showy feature.",
      "The thing I'd mention is {list}. {store} felt looked-after in the ways that actually matter when you're tired.",
    ],
    bridgesLong: ["Check-in was smooth and the staff were genuinely helpful at {store}, which set the tone for the whole stay."],
    closersLong: ["I'd stay at {store} again next time I'm in the area and happily recommend it."],
  },
  auto: {
    openersLong: [
      "Took my car to {store} braced for the usual upsell, and instead got a straight answer and a fair job.",
      "Had {store} sort a problem another garage couldn't pin down, and they got it right without the runaround.",
    ],
    openersShort: ["{store} was honest, quick and fairly priced; I'd bring the car back."],
    coresLong: [
      "What won me over was {list}. At {store} they explained the work and only did what actually needed doing.",
      "The part worth noting is {list}. {store} was upfront about the cost and didn't invent extra jobs.",
    ],
    bridgesLong: ["They kept me updated and the final bill matched the quote at {store}, which isn't a given with garages."],
    closersLong: ["I'd take my car back to {store} without shopping around, and I've told a couple of mates the same."],
  },
};

const JA_VERTICAL: Partial<Record<Vertical, Partial<PoolSet>>> = {
  restaurant: {
    openersLong: [
      "先日{store}で食事をしました。料理を中心に、印象に残った点を書いておきます。",
      "{store}での食事は、店を出たあと思わず感想を書きたくなるような時間でした。",
    ],
    openersShort: ["{store}、また食べに行きたいです。", "手短に{store}の感想を。良い食事で、印象的な一皿もありました。"],
    coresLong: [
      "特に良かったのは{list}でした。{store}では最初の一口から最後までその印象が続きました。",
      "要するに{list}が丁寧に仕上げられていて、それが{store}の良さだと思います。",
    ],
    bridgesLong: ["量に対して価格も妥当で、{store}は厨房と接客のテンポも揃っていました。"],
    closersLong: ["お腹を空かせて、また{store}に伺いたいと思います。"],
  },
  cafe: {
    openersLong: ["{store}でコーヒーを飲むつもりが、予定より長く居てしまいました。それだけ居心地が良かったです。"],
    openersShort: ["{store}はゆっくり過ごすのにちょうど良いお店です。"],
    coresLong: ["細かい部分が良くて、{list}。{store}はこだわりを感じました。"],
    closersLong: ["静かに過ごしたい時に、また{store}に伺います。"],
  },
  beauty: {
    openersLong: [
      "{store}で施術をしてもらいました。仕上がりが思っていた以上で満足しています。",
      "初めてのお店で少し緊張しつつ{store}を予約しましたが、行って良かったです。",
    ],
    openersShort: ["{store}はとても良かったです。また予約したいです。"],
    coresLong: ["決め手は{list}でした。{store}はこちらの希望をきちんと聞いてくれた印象です。"],
    bridgesLong: ["{store}は一つひとつ説明してくれたので、急かされて決める感じがありませんでした。"],
    closersLong: ["早くも次回の予約を考えていて、自分としては珍しいです。{store}が良かった証拠です。"],
  },
  clinic: {
    openersLong: [
      "{store}を受診しました。全体的に落ち着いていて、説明も分かりやすかったです。",
      "勝手が分からないまま{store}に伺いましたが、安心して受けられました。",
    ],
    openersShort: ["{store}は丁寧で、安心して任せられました。"],
    coresLong: ["良かったのは{list}でした。{store}では急かされず、きちんと説明してもらえました。"],
    bridgesLong: ["{store}のスタッフは丁寧で、質問にも一つずつ答えてくれました。"],
    closersLong: ["また{store}にお願いしたいですし、家族にも勧められます。"],
  },
  retail: {
    openersLong: ["先日{store}で買い物をしました。想像より対応が良く、気持ちよく買えました。"],
    openersShort: ["{store}は一度覗く価値ありです。目的の物も見つかりました。"],
    coresLong: ["良かったのは{list}で、{store}は買い物全体を分かりやすくしてくれました。"],
    closersLong: ["近くに来たら、また{store}で買い物をすると思います。"],
  },
  fitness: {
    openersLong: ["{store}で体を動かしてきました。気負わず通える良い雰囲気でした。"],
    openersShort: ["{store}はしっかり運動できる良い環境です。"],
    coresLong: ["通いたくなる理由は{list}でした。{store}は続けやすいです。"],
    closersLong: ["難しく考えずに通える場所を探している人に、{store}はおすすめです。"],
  },
  dental: {
    openersLong: [
      "{store}に検診で伺いました。歯医者はつい身構えてしまいますが、思っていたより落ち着いて受けられました。",
      "別のところで嫌な思いをして{store}に変えましたが、初回から違いがはっきり分かりました。",
    ],
    openersShort: ["{store}は痛みも少なく、また通いたいと思える歯科でした。"],
    coresLong: [
      "他と違ったのは{list}でした。{store}は処置の前にきちんと説明してくれて、不安なまま進むことがありませんでした。",
      "自分にとって大事だったのは{list}で、{store}は急がず丁寧に対応してくれました。",
    ],
    bridgesLong: ["{store}は治療方針も費用も先に説明してくれたので、後から驚くことがありませんでした。"],
    closersLong: ["{store}なら家族の歯も任せられます。歯科でそう思えることは多くありません。"],
  },
  aesthetic: {
    openersLong: [
      "やりすぎにならないか少し不安なまま{store}で施術を受けましたが、丁寧なところを選んで良かったです。",
      "{store}にカウンセリングで伺い、不要なものを無理に勧めてこない姿勢に好感が持てました。",
    ],
    openersShort: ["{store}は仕上がりが自然で説明も正直、また伺いたいです。"],
    coresLong: [
      "決め手は{list}でした。{store}の仕上がりは別人ではなく、自分のまま少し良くなった感じで満足です。",
      "挙げたいのは{list}で、{store}は速さより安全さを優先しているのが伝わりました。",
    ],
    bridgesLong: ["{store}はカウンセリングが丁寧で衛生面もきちんとしていて、安心して任せられました。"],
    closersLong: ["早くも次回を考えていて、派手なお店より{store}を人に勧めたいです。"],
  },
  realestate: {
    openersLong: [
      "気が重かった引っ越しを{store}にお願いしましたが、想像よりずっと負担が軽くなりました。",
      "物件探しで{store}に相談しましたが、こちらの希望をきちんと聞いてくれる点が他と違いました。",
    ],
    openersShort: ["{store}は不動産まわりを分かりやすく進めてくれて、本当に助かりました。"],
    coresLong: [
      "良かったのは{list}でした。{store}は先方都合の物件を押し付けてくる感じがありませんでした。",
      "挙げるなら{list}で、{store}は成約を急ぐより相場を正直に話してくれました。",
    ],
    bridgesLong: ["{store}は書類や引き渡しの段階でも連絡がまめで、担当者が静かになりがちな場面こそ頼りになりました。"],
    closersLong: ["次の引っ越しもまた{store}にお願いしたいですし、家探し中の知人にも紹介します。"],
  },
  legal: {
    openersLong: [
      "先延ばしにしていた相談を{store}にしましたが、気が重かった状況を整理してもらえました。",
      "専門用語で煙に巻かれると思っていましたが、{store}は自分にも分かる言葉で答えてくれました。",
    ],
    openersShort: ["{store}は説明が明快で対応も早く、また相談したいです。"],
    coresLong: [
      "良かったのは{list}でした。{store}は選択肢を分かりやすく示し、無理に決めさせませんでした。",
      "印象に残ったのは{list}で、{store}は費用も期間も最初にはっきり伝えてくれました。",
    ],
    bridgesLong: ["{store}は言った期日にきちんと連絡をくれて、進捗も共有してくれました。当たり前のようで貴重です。"],
    closersLong: ["また{store}にお願いしたいですし、すでに同僚にも勧めています。"],
  },
  home: {
    openersLong: [
      "不安だった自宅の工事を{store}にお願いしましたが、思っていたよりきれいに仕上げてくれました。",
      "何社か見積もりを取って{store}に決めましたが、仕上がりを見て正解だったと思いました。",
    ],
    openersShort: ["{store}は丁寧で工期も守り、見積もり通りで安心でした。"],
    coresLong: [
      "決め手は{list}でした。{store}は最終金額が見積もり通りで、仕上がりも近くで見て納得できました。",
      "挙げたいのは{list}で、{store}は現場もきれいに保ち、言った通りの日程で進めてくれました。",
    ],
    bridgesLong: ["{store}は予定通りに来てくれて後片付けもしっかりで、正直これは当たり前ではないと思います。"],
    closersLong: ["次の工事もまた{store}にお願いしたいですし、近所の人にも連絡先を教えました。"],
  },
  education: {
    openersLong: [
      "続くか不安なまま{store}に通い始めましたが、今では自分から楽しみにするようになりました。",
      "家族で{store}のレッスンを始めましたが、思っていたより早く成果が見えてきました。",
    ],
    openersShort: ["{store}は学ぶことを身近にしてくれて、始めて良かったです。"],
    coresLong: [
      "良かったのは{list}でした。{store}は決まった型ではなく、こちらのレベルに合わせて教えてくれました。",
      "挙げるなら{list}で、{store}は励ましつつも内容を薄めない教え方でした。",
    ],
    bridgesLong: ["{store}は進み具合をこまめに共有してくれて、不要なものを勧めてくることもありませんでした。"],
    closersLong: ["迷っている人に{store}はおすすめです。ここで続けてきて良かったと思います。"],
  },
  pet: {
    openersLong: [
      "少し不安げな愛犬を{store}に連れて行きましたが、優しく落ち着いて対応してくれて、こちらも安心できました。",
      "初めて猫を{store}に連れて行きましたが、丁寧で正直な対応で、また通いたいと思えました。",
    ],
    openersShort: ["{store}はうちの子に優しく説明も丁寧で、また伺います。"],
    coresLong: [
      "良かったのは{list}でした。{store}はうちの子を本当に大切に扱ってくれて、急かすこともありませんでした。",
      "挙げたいのは{list}で、{store}は必要なことだけを正直に伝えてくれました。",
    ],
    bridgesLong: ["{store}は一つずつ分かりやすく説明してくれて、前のところより明らかにうちの子も落ち着いていました。"],
    closersLong: ["これからも{store}にお願いしたいですし、他の飼い主さんにも話しました。"],
  },
  hotel: {
    openersLong: [
      "{store}に数泊しましたが、大事なところを静かにきちんと押さえてくれる滞在でした。",
      "期待値を決めずに{store}を予約しましたが、結果的に気楽で快適に過ごせました。",
    ],
    openersShort: ["{store}は快適で手間のかからない滞在で、また泊まりたいです。"],
    coresLong: [
      "滞在を良くしたのは{list}でした。{store}は派手な一点ではなく、細部の積み重ねで印象に残りました。",
      "挙げたいのは{list}で、{store}は疲れている時こそありがたい部分がきちんとしていました。",
    ],
    bridgesLong: ["{store}はチェックインもスムーズでスタッフも親身で、それが滞在全体の空気を作っていました。"],
    closersLong: ["また近くに来たら{store}に泊まりたいですし、人にも勧められます。"],
  },
  auto: {
    openersLong: [
      "いつもの過剰な勧めを覚悟して{store}に車を持ち込みましたが、正直な説明と適正な対応で拍子抜けしました。",
      "他の整備工場で原因が分からなかった不具合を{store}が的確に直してくれて、遠回りがありませんでした。",
    ],
    openersShort: ["{store}は正直で早く、価格も適正でした。また車を任せたいです。"],
    coresLong: [
      "納得できたのは{list}でした。{store}は作業内容を説明し、本当に必要な分だけ対応してくれました。",
      "挙げるなら{list}で、{store}は費用も先に明確にし、余計な作業を足しませんでした。",
    ],
    bridgesLong: ["{store}は連絡もまめで、最終金額も見積もり通りでした。整備工場では当たり前ではないと思います。"],
    closersLong: ["次も他を回らず{store}に車を任せます。友人にも同じように勧めました。"],
  },
};

const GENERIC: Record<ReviewLocale, PoolSet> = { en: EN_GENERIC, ja: JA_GENERIC };
const VERTICAL: Record<ReviewLocale, Partial<Record<Vertical, Partial<PoolSet>>>> = {
  en: EN_VERTICAL,
  ja: JA_VERTICAL,
};

/** Resolve the merged pool for a locale + vertical (generic base + flavour). */
export function resolvePoolSet(locale: ReviewLocale, vertical: Vertical): PoolSet {
  const base = GENERIC[locale] ?? GENERIC.en;
  if (vertical === "generic") return base;
  const flavour = VERTICAL[locale]?.[vertical];
  return flavour ? mergePool(base, flavour) : base;
}
