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
  | "clinic"
  | "retail"
  | "fitness"
  | "hotel"
  | "auto"
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

/** Map a free-text store business_category to a canonical vertical. */
export function resolveVertical(category: string | null | undefined): Vertical {
  const c = (category ?? "").toLowerCase();
  if (!c) return "generic";
  if (/restaurant|dining|food|sushi|ramen|izakaya|grill|bbq|steak|bistro|eatery|kitchen|飲食|レストラン|居酒屋|食堂/.test(c)) return "restaurant";
  if (/cafe|coffee|tea|bakery|dessert|patisserie|カフェ|喫茶|ベーカリー/.test(c)) return "cafe";
  if (/salon|beauty|spa|nail|hair|barber|lash|brow|美容|ネイル|エステ|理容|サロン/.test(c)) return "beauty";
  if (/clinic|dental|medical|hospital|doctor|dentist|pharmacy|therapy|chiro|clinic|クリニック|歯科|医院|病院|治療|整体|接骨/.test(c)) return "clinic";
  if (/shop|store|retail|boutique|market|grocery|apparel|florist|店|ショップ|小売|雑貨/.test(c)) return "retail";
  if (/gym|fitness|yoga|pilates|studio|training|crossfit|ジム|フィットネス|ヨガ|トレーニング/.test(c)) return "fitness";
  if (/hotel|inn|motel|resort|hostel|accommodation|lodging|ホテル|旅館|宿/.test(c)) return "hotel";
  if (/auto|car|mechanic|garage|tyre|tire|body shop|detailing|自動車|整備|車/.test(c)) return "auto";
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
  ],
  coresCompact: [
    "What worked: {list}.",
    "{store} really showed up on {list}.",
    "I'd call out {list} as what made the visit memorable.",
    "Bright spots: {list}.",
    "{store}: {list}. Enough said.",
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
  ],
  bridgesShort: [
    "Front of house at {store} was in step with everything else.",
    "Nothing felt slapdash. {store} had its act together.",
    "{store} kept things moving without making me clock-watch.",
    "The space was easy to settle into, no awkward shuffle.",
  ],
  closersLong: [
    "I'd go back to {store} without overthinking it, and the stuff above is what I'd tell someone choosing this week.",
    "Happy to recommend {store}: fair for what I got, and the visit felt easy from start to finish.",
    "Bottom line: {store} did the important parts well, and if my experience is typical it's a solid pick.",
    "I'll put {store} in the rotation; not every place earns that after one visit.",
    "{store} is the kind of place I'd send people who complain that reviews all sound fake, because my visit felt grounded.",
  ],
  closersShort: [
    "{store} gets a yes from me; I'll be back.",
    "I'd send people to {store}; it was worth the time.",
    "No drama: {store} was simply good.",
    "Skip the overthinking and try {store}.",
  ],
  fillers: [
    "That steady quality is a big part of why I'd pick {store} again over rolling the dice somewhere new.",
    "Walking out of {store}, I already knew I'd be back, and that's usually a good sign.",
    "It's rare that I leave {store} without a single nitpick, and this time the nits were small.",
    "{store} felt like a place that wants repeat locals, not one-and-done visitors.",
    "I'd rather under-promise on {store} and have a friend be pleasantly surprised.",
  ],
  tails: [
    "{kw} was a highlight for me.",
    "They came through on {kw}.",
    "No complaints on {kw}.",
    "{kw} felt genuine, not bolted on.",
    "I'd point to {kw} if someone asked what to expect.",
    "{kw} didn't get lost in the shuffle.",
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
  ],
  openersShort: [
    "{store}に行ってきました。全体的に良い時間で、いくつか具体的に触れておきます。",
    "先日{store}を利用。良かった点がはっきりしていて、今でも覚えています。",
    "{store}は完璧とまでは言いませんが、良かった部分は本物で、また利用したいです。",
    "{store}、また利用すると思います。",
    "手短に言うと、{store}は肝心なところがしっかりしていました。",
    "記憶が新しいうちに。{store}には印象的な瞬間がいくつかありました。",
  ],
  coresLong: [
    "特に良かったのは{list}でした。{store}ではそこが言葉だけでなく、きちんと気を配っているのが伝わりました。",
    "今回の利用を一言でまとめるなら{list}です。{store}は最初から最後までその印象が続きました。",
    "同僚や近所の人に伝えたくなるのは{list}で、ありきたりな褒め言葉ではない具体性がありました。",
    "良かった点の軸は{list}に集約されます。{store}はそこを手を抜かずやっていました。",
    "要するに{list}が丁寧に揃っていて、それが{store}の良さだと思います。",
    "自分にとっての決め手は{list}で、{store}はそこをしっかり形にしていました。",
  ],
  coresCompact: [
    "良かった点は{list}です。",
    "{store}は{list}がしっかりしていました。",
    "印象に残ったのは{list}でした。",
    "特筆すべきは{list}です。",
    "{store}、{list}。以上です。",
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
  ],
  bridgesShort: [
    "{store}は接客と全体の流れが噛み合っていました。",
    "雑な部分がなく、{store}はしっかりしていました。",
    "{store}は時間を気にさせずテンポよく進めてくれました。",
    "空間になじみやすく、ぎこちなさがありませんでした。",
  ],
  closersLong: [
    "また{store}を利用したいと思います。上に書いた点が、今週どこにしようか迷う人に伝えたい内容です。",
    "{store}は素直におすすめできます。内容に対して妥当で、入店から退店まで気持ちよく過ごせました。",
    "結論として、{store}は肝心なところをきちんと押さえていて、今回が標準的なら十分に良い選択だと思います。",
    "{store}は自分の中の候補に加えます。一度の利用でそう思える店は多くありません。",
    "レビューは当てにならないと言う人にこそ勧めたい、{store}はそう思える利用でした。",
  ],
  closersShort: [
    "{store}はおすすめです。また伺います。",
    "人に勧めたくなる、{store}はそんなお店でした。",
    "余計なことは抜きに、{store}は普通に良かったです。",
    "迷うなら{store}を試してみてください。",
  ],
  fillers: [
    "この安定感があるので、新しい所で外すより次回も{store}を選ぶと思います。",
    "{store}を出るときには、また来ようと自然に思えました。良い兆候だと思います。",
    "{store}で全く不満なく終わることは珍しく、今回は気になる点もごく小さなものでした。",
    "{store}は一度きりの客より、通ってくれる地元客を大事にしている雰囲気でした。",
  ],
  tails: [
    "{kw}も良かったです。",
    "{kw}はきちんと応えてくれました。",
    "{kw}に不満はありません。",
    "{kw}は取ってつけた感がなく自然でした。",
    "何を期待できるか聞かれたら{kw}を挙げます。",
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
