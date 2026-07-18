/**
 * Review phrase pools, keyed by locale (en/ja/ar) and business vertical.
 *
 * GENERIC pools are industry-neutral (no food nouns) so they read naturally for
 * ANY local business. Vertical pools add category flavour and are merged on top
 * of GENERIC (concatenated) by resolvePoolSet.
 *
 * Placeholders: {store} {list} {a} {b} {kw}. Guest voice, first person, no
 * typographic long dashes, no SEO/AIO/marketing jargon.
 *
 * Arabic (ar) is Modern Standard Arabic, first-person guest voice, sentences
 * ending in "." (so the engine's tail-trimming works identically to en). {list}
 * and {store} may hold Latin text (English SEO keywords / a Latin store name);
 * the join uses spaced " و " so a mixed Arabic+Latin list stays readable.
 */

export type ReviewLocale = "en" | "ja" | "ar";
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
    "Came to {store} for the first time and I'll definitely be back.",
    "Been meaning to try {store} for ages and finally made it, so glad I did.",
    "Popped into {store} on the weekend and it was a really good visit.",
    "First time at {store} and it lived up to what friends had been telling me.",
    "Had a great time at {store}, leaving this so a few more people give it a go.",
    "Went to {store} not expecting much and came away really happy.",
    "{store} was recommended to me and now I see why people rave about it.",
    "Stopped by {store} today and it was well worth the trip.",
    "Tried {store} for the first time this week and it did not disappoint.",
    "Really good experience at {store}, and I don't usually bother leaving reviews.",
    "Visited {store} with the family and we all left happy.",
    "{store} is one of those local spots I'll be telling everyone about.",
  ],
  openersShort: [
    "Great little visit to {store}.",
    "{store}? Definitely going back.",
    "Really happy with {store}.",
    "Solid visit to {store}, no complaints.",
    "{store} did not disappoint.",
    "Left {store} in a good mood.",
    "First time at {store} and I'm impressed.",
    "Quick shout-out to {store}.",
  ],
  coresLong: [
    "{list} really stood out.",
    "Loved {list}, that was the highlight for me.",
    "{list} alone made the trip worth it.",
    "{store} absolutely nailed {list}.",
    "Honestly, {list} made the visit for me.",
    "{list}, that's the reason I'll be going back.",
    "Big fan of {list} here.",
    "Can't say enough about {list}.",
    "What got me was {list}, genuinely good.",
    "{list} turned out even better than I expected.",
  ],
  coresCompact: [
    "Loved {list}.",
    "{list}, spot on.",
    "{list}, so good.",
    "Highlight for me was {list}.",
    "Go for {list}.",
    "{list} won me over.",
    "{store} nailed {list}.",
    "Big yes to {list}.",
  ],
  dualBlocks: [
    "{a} stood out, and {b} came close behind.",
    "Loved {a}, and {b} came as a nice surprise too.",
    "{a} stood out first, then {b} sealed it.",
    "Between {a} and {b}, {store} won me over.",
  ],
  bridgesLong: [
    "The staff were friendly and quick, no waiting around.",
    "The place was clean and comfortable, easy to settle in.",
    "Prices felt fair for what you get.",
    "Service was warm without being pushy.",
    "They sorted out a small request without any fuss.",
    "Everything ran smoothly from start to finish.",
    "You can tell the team cares about getting the details right.",
    "Nice, relaxed atmosphere, never felt rushed.",
  ],
  bridgesShort: [
    "Friendly, quick service.",
    "Clean and comfortable.",
    "Fair prices too.",
    "Staff were lovely.",
    "Smooth from start to finish.",
    "Really well run.",
  ],
  closersLong: [
    "I'd happily recommend {store} to anyone.",
    "Will definitely be back to {store}.",
    "{store} is a solid choice, give it a go.",
    "Adding {store} to my regular list.",
    "If you haven't tried {store} yet, do.",
    "Can't recommend {store} enough.",
    "{store} has a new regular in me.",
    "Already planning my next visit to {store}.",
  ],
  closersShort: [
    "Highly recommend {store}.",
    "Will be back.",
    "{store} gets a yes from me.",
    "Give {store} a try.",
    "Solid all round.",
    "Back again soon for sure.",
    "Recommend {store}.",
  ],
  fillers: [
    "Little things like that are why I'll pick {store} again.",
    "Walked out already planning to come back.",
    "The kind of place you want to tell people about.",
    "Everything just felt easy, which I appreciate.",
    "Small touches that made the visit.",
    "Exactly what I was hoping for.",
    "Nice to find a spot this reliable.",
  ],
  // No hardcoded article before {kw}: the engine supplies "the " only for
  // lowercase common-noun phrases (withArt), so proper-noun keywords stay bare.
  // Verbs are number-neutral (no is/was) so plural phrases can't disagree.
  tails: [
    "Also have to mention {kw}.",
    "{kw} lived up to the hype.",
    "Really enjoyed {kw}.",
    "No notes on {kw}.",
    "Ask about {kw} while you're there.",
    "Worth going back for {kw} alone.",
    "Definitely try {kw}.",
    "{kw} stood out most for me.",
    "Also a big fan of {kw}.",
  ],
  microOpeners: [
    "Had to leave a review.",
    "Quick note.",
  ],
  noKeywordMid: [
    "The whole visit just went smoothly, and the service alone would bring me back to {store}.",
    "Nothing to complain about, {store} kept it simple and did it well.",
  ],
};

// =========================================================== JA · GENERIC ===
const JA_GENERIC: PoolSet = {
  openersLong: [
    "先日{store}に行ってきました。また利用したいと思える良いお店でした。",
    "気になっていた{store}にようやく行けました。行って良かったです。",
    "週末に{store}を利用しました。とても良い時間を過ごせました。",
    "{store}は初めてでしたが、評判どおりで満足しました。",
    "{store}で楽しい時間を過ごせたので、レビューを残しておきます。",
    "あまり期待せずに{store}へ行きましたが、良い意味で裏切られました。",
    "知人に勧められて{store}に行きましたが、人気の理由が分かりました。",
    "今日{store}に立ち寄りましたが、来て良かったです。",
    "今週初めて{store}を利用しましたが、期待以上でした。",
    "{store}での対応がとても良く、普段はレビューを書かないのですが残します。",
    "家族で{store}に行きましたが、みんな満足して帰りました。",
    "{store}は人にも紹介したくなる、地元の良いお店です。",
  ],
  openersShort: [
    "{store}、とても良かったです。",
    "{store}、また行きます。",
    "{store}に満足しています。",
    "{store}、文句なしでした。",
    "{store}、期待を裏切りませんでした。",
    "{store}を出るとき気分が良かったです。",
    "初めての{store}、好印象でした。",
    "{store}に一言だけ。",
  ],
  coresLong: [
    "特に{list}が良かったです。",
    "{list}が一番の魅力でした。",
    "{list}が目当てでしたが、期待どおりでした。",
    "{store}は{list}が本当にしっかりしていました。",
    "正直、{list}が一番の収穫でした。",
    "また来たい理由は{list}です。",
    "{list}がとても気に入りました。",
    "{list}については何度でも言いたいくらいです。",
    "心をつかまれたのは{list}でした。",
    "{list}は思っていた以上に良かったです。",
  ],
  coresCompact: [
    "{list}が良かったです。",
    "{list}、最高でした。",
    "推しは{list}です。",
    "{list}目当てでぜひ。",
    "{store}は{list}が光ります。",
    "{list}にやられました。",
    "{list}、文句なし。",
  ],
  dualBlocks: [
    "{a}も良かったですし、{b}も同じくらい良かったです。",
    "まず{a}が良く、{b}も嬉しい驚きでした。",
    "{a}が印象に残り、{b}で決まりでした。",
    "{a}と{b}、どちらも{store}で気に入りました。",
  ],
  bridgesLong: [
    "スタッフの対応も丁寧で、待たされることもありませんでした。",
    "店内は清潔で居心地がよかったです。",
    "値段も内容に見合っていて納得でした。",
    "接客は親切で、押し付けがましさもありませんでした。",
    "ちょっとしたお願いにも快く応じてくれました。",
    "最初から最後までスムーズでした。",
    "細かいところまで気を配っているのが伝わりました。",
    "落ち着いた雰囲気で、急かされる感じもありませんでした。",
  ],
  bridgesShort: [
    "接客も親切で早かったです。",
    "清潔で居心地良し。",
    "値段も良心的でした。",
    "スタッフが感じ良かったです。",
    "最初から最後まで快適でした。",
    "とてもよく回っていました。",
  ],
  closersLong: [
    "{store}は自信を持っておすすめできます。",
    "また{store}に行きます。",
    "{store}は良い選択だと思います、ぜひ。",
    "{store}を行きつけに加えます。",
    "まだ{store}に行っていないなら、ぜひ。",
    "{store}は本当におすすめです。",
    "{store}の常連になりそうです。",
    "早くも次に{store}へ行くのが楽しみです。",
  ],
  closersShort: [
    "{store}、強くおすすめします。",
    "また来ます。",
    "{store}、おすすめです。",
    "{store}をぜひ。",
    "総じて良かったです。",
    "また近いうちに。",
    "{store}をおすすめします。",
  ],
  fillers: [
    "こういう細かい良さがあるので、また{store}を選ぶと思います。",
    "帰る頃には、また来ようと思っていました。",
    "人に教えたくなるお店です。",
    "全体的に気持ちよく過ごせました。",
    "ちょっとした心遣いが嬉しかったです。",
    "まさに期待していたとおりでした。",
    "これだけ安定していると安心できます。",
  ],
  tails: [
    "{kw}も良かったです。",
    "{kw}はぜひ試してほしいです。",
    "{kw}に不満はありません。",
    "{kw}は評判どおりでした。",
    "{kw}だけでも行く価値があります。",
    "{kw}もとても気に入りました。",
    "{kw}は特に印象に残りました。",
    "行くなら{kw}もおすすめです。",
  ],
  microOpeners: [
    "一言だけ。",
    "レビューを残します。",
  ],
  noKeywordMid: [
    "全体的にスムーズで、対応の良さだけでもまた{store}に来たいと思えました。",
    "特に不満もなく、{store}は基本をきちんと押さえた良いお店でした。",
  ],
};

// =========================================================== AR · GENERIC ===
// Modern Standard Arabic, first-person guest voice. Sentences end in "." so the
// engine's sentence trimming matches en. {list}/{store} may carry Latin text.
const AR_GENERIC: PoolSet = {
  openersLong: [
    "زرت {store} لأول مرة وسأعود بالتأكيد.",
    "كنت أنوي تجربة {store} منذ فترة، وأخيراً فعلت، وأنا سعيد بذلك.",
    "مررت على {store} في نهاية الأسبوع وكانت زيارة جيدة حقاً.",
    "أول زيارة لي إلى {store} كانت عند حسن الظن كما أخبرني الأصدقاء.",
    "قضيت وقتاً ممتعاً في {store}، وأترك هذا التقييم ليجرّبه غيري.",
    "ذهبت إلى {store} من دون توقعات كبيرة وخرجت سعيداً جداً.",
    "أوصاني أحدهم بـ {store}، والآن أفهم سبب الإشادة به.",
    "مررت على {store} اليوم وكان يستحق الزيارة.",
    "جرّبت {store} لأول مرة هذا الأسبوع ولم يخيّب ظني.",
    "تجربة جيدة جداً في {store}، ولا أكتب التقييمات عادةً.",
    "زرت {store} مع العائلة وخرجنا جميعاً سعداء.",
    "{store} من الأماكن المحلية التي سأوصي بها الجميع.",
  ],
  openersShort: [
    "زيارة رائعة إلى {store}.",
    "{store}؟ سأعود بالتأكيد.",
    "سعيد جداً بـ {store}.",
    "زيارة متينة إلى {store}، بلا ملاحظات.",
    "{store} لم يخيّب ظني.",
    "خرجت من {store} بمزاج جيد.",
    "أول زيارة إلى {store} وأنا معجب.",
    "كلمة سريعة عن {store}.",
  ],
  coresLong: [
    "{list} لفت انتباهي فعلاً.",
    "أحببت {list}، كان أبرز ما في الزيارة.",
    "جئت من أجل {list} ولم يخيّب ظني.",
    "{store} أتقن {list} تماماً.",
    "بصراحة، {list} كان أفضل جزء في الزيارة.",
    "سبب عودتي هو {list}.",
    "معجب جداً بـ {list} هنا.",
    "لا أستطيع أن أمدح {list} بما يكفي.",
    "ما أعجبني هو {list}، جيد فعلاً.",
    "{list} كان أفضل مما توقعت.",
  ],
  coresCompact: [
    "أحببت {list}.",
    "{list} كان ممتازاً.",
    "الأبرز: {list}.",
    "اذهب من أجل {list}.",
    "{store} أبدع في {list}.",
    "{list} كسب إعجابي.",
    "نعم كبيرة لـ {list}.",
  ],
  dualBlocks: [
    "{a} كان رائعاً، و{b} كان بالجودة نفسها.",
    "أحببت {a}، و{b} كان مفاجأة لطيفة أيضاً.",
    "{a} برز أولاً، ثم حسم {b} الأمر.",
    "بين {a} و{b}، كسب {store} إعجابي.",
  ],
  bridgesLong: [
    "كان الطاقم ودوداً وسريعاً، بلا انتظار.",
    "المكان نظيف ومريح، من السهل الاستقرار فيه.",
    "الأسعار عادلة مقابل ما تحصل عليه.",
    "كانت الخدمة لطيفة من دون إلحاح.",
    "لبّوا طلباً صغيراً من دون أي عناء.",
    "سار كل شيء بسلاسة من البداية إلى النهاية.",
    "يظهر أن الفريق يهتم بالتفاصيل.",
    "أجواء هادئة ومريحة، بلا استعجال.",
  ],
  bridgesShort: [
    "خدمة ودودة وسريعة.",
    "نظيف ومريح.",
    "وأسعار عادلة.",
    "الطاقم لطيف.",
    "سلاسة من البداية إلى النهاية.",
    "إدارة ممتازة.",
  ],
  closersLong: [
    "أوصي بـ {store} للجميع بكل سرور.",
    "سأعود إلى {store} بالتأكيد.",
    "{store} خيار متين، جرّبه.",
    "أضفت {store} إلى قائمتي المعتادة.",
    "إن لم تجرّب {store} بعد، فافعل.",
    "لا أستطيع أن أوصي بـ {store} بما يكفي.",
    "أصبحت زبوناً دائماً لـ {store}.",
    "أخطط بالفعل لزيارتي القادمة إلى {store}.",
  ],
  closersShort: [
    "أوصي بشدة بـ {store}.",
    "سأعود.",
    "{store} يحصل على نعم مني.",
    "جرّب {store}.",
    "متين في كل شيء.",
    "سأعود قريباً بالتأكيد.",
    "أوصي بـ {store}.",
  ],
  fillers: [
    "أمور صغيرة كهذه تجعلني أختار {store} مجدداً.",
    "خرجت وأنا أخطط للعودة.",
    "من الأماكن التي تحب أن تخبر الناس عنها.",
    "كل شيء بدا سهلاً، وهذا ما أقدّره.",
    "لمسات صغيرة صنعت الزيارة.",
    "تماماً ما كنت آمله.",
    "من الجميل أن تجد مكاناً بهذا الثبات.",
  ],
  tails: [
    "يجب أن أذكر {kw} أيضاً.",
    "{kw} كان عند مستوى السمعة.",
    "استمتعت بـ {kw} حقاً.",
    "لا ملاحظات على {kw}.",
    "اسأل عن {kw} حين تكون هناك.",
    "{kw} يستحق وحده.",
    "جرّب {kw} بالتأكيد.",
    "{kw} كان من الأبرز.",
  ],
  microOpeners: [
    "كان عليّ ترك تقييم.",
    "ملاحظة سريعة.",
  ],
  noKeywordMid: [
    "سارت الزيارة بسلاسة، والخدمة وحدها تكفي لأعود إلى {store}.",
    "لا شيء يستحق الشكوى، {store} أتقن الأساسيات وأدّاها جيداً.",
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
      "{list}が特に美味しかったです。",
      "{list}が最高で、また食べに来たいです。",
    ],
    bridgesLong: ["量の割に価格も良心的で、料理もテンポよく出てきました。"],
    closersLong: ["お腹を空かせて、また{store}に伺いたいです。"],
  },
  cafe: {
    openersLong: ["{store}でコーヒーを飲むつもりが、予定より長く居てしまいました。それだけ居心地が良かったです。"],
    openersShort: ["{store}はゆっくり過ごすのにちょうど良いお店です。"],
    coresLong: ["{list}が良くて、{store}のこだわりを感じました。"],
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

const AR_VERTICAL: Partial<Record<Vertical, Partial<PoolSet>>> = {
  restaurant: {
    openersLong: [
      "تناولنا الطعام في {store} مؤخراً، وأحببت أن أدوّن ما بقي في ذاكرتنا على الطاولة.",
      "كان العشاء في {store} من النوع الذي تخرج بعده وتريد فعلاً أن تكتب عنه شيئاً.",
    ],
    openersShort: ["{store}؟ نعم، سنعود لتناول الطعام هناك.", "انطباع سريع بعد {store}: وجبة جيدة، مع أطباق مميزة."],
    coresLong: [
      "{list} كان لذيذاً بالفعل.",
      "{list} كان الأفضل في الوجبة، وسأعود من أجله.",
    ],
    bridgesLong: ["الأسعار عادلة مقابل الكميات، والأطباق وصلت بسرعة."],
    closersLong: ["سأعود جائعاً إلى {store} من دون تفكير طويل."],
  },
  cafe: {
    openersLong: ["طلبت قهوة في {store} وانتهى بي الأمر بالبقاء أطول مما خططت، وهذا يقول شيئاً."],
    openersShort: ["{store} مكان جيد للجلوس والاسترخاء قليلاً."],
    coresLong: ["التفاصيل الصغيرة هي ما أحببته: {list}. من الواضح أن {store} يهتم بالتفاصيل."],
    closersLong: ["سأعود إلى {store} في المرة القادمة التي أريد فيها مكاناً هادئاً للجلوس."],
  },
  beauty: {
    openersLong: [
      "ذهبت إلى {store} لموعد وخرجت أكثر رضاً عن النتيجة مما توقعت.",
      "حجزت في {store} وأنا متوترة قليلاً من مكان جديد، وأنا سعيدة أنني فعلت.",
    ],
    openersShort: ["{store} قدّم عملاً رائعاً؛ سأحجز مجدداً."],
    coresLong: ["ما صنع الفرق كان {list}. في {store} شعرت أنهم أنصتوا فعلاً لما أردته."],
    bridgesLong: ["شرحوا لي كل شيء في {store}، فلم أشعر أبداً أنني مدفوعة لقرار متعجل."],
    closersLong: ["فكرت بالفعل في موعدي القادم في {store}، وهذا غير معتاد بالنسبة لي."],
  },
  clinic: {
    openersLong: [
      "زرت {store} لموعد، وكان كل شيء أهدأ وأوضح مما اعتدت عليه.",
      "دخلت {store} غير متأكد مما أتوقعه وخرجت مطمئناً.",
    ],
    openersShort: ["{store} كان محترفاً وجعلني مرتاحاً."],
    coresLong: ["ما لفت انتباهي كان {list}. في {store} شُرحت الأمور كما يجب، من دون استعجال."],
    bridgesLong: ["كان طاقم {store} صبوراً وأجاب عن الأسئلة من دون أن يجعلني مجرد رقم."],
    closersLong: ["سأثق بـ {store} مجدداً وسأرشّح العائلة إليه."],
  },
  retail: {
    openersLong: ["تسوّقت في {store} مؤخراً، وكانت الزيارة أسهل وأكثر ودّاً مما توقعت."],
    openersShort: ["{store} يستحق النظر؛ وجدت ما أحتاجه وأكثر."],
    coresLong: ["ما جعلها تنجح كان {list}. {store} جعل الأمر كله بسيطاً."],
    closersLong: ["سأتسوّق في {store} مجدداً في المرة القادمة التي أكون فيها قريباً."],
  },
};

const GENERIC: Record<ReviewLocale, PoolSet> = { en: EN_GENERIC, ja: JA_GENERIC, ar: AR_GENERIC };
const VERTICAL: Record<ReviewLocale, Partial<Record<Vertical, Partial<PoolSet>>>> = {
  en: EN_VERTICAL,
  ja: JA_VERTICAL,
  ar: AR_VERTICAL,
};

/** Resolve the merged pool for a locale + vertical (generic base + flavour). */
export function resolvePoolSet(locale: ReviewLocale, vertical: Vertical): PoolSet {
  const base = GENERIC[locale] ?? GENERIC.en;
  if (vertical === "generic") return base;
  const flavour = VERTICAL[locale]?.[vertical];
  return flavour ? mergePool(base, flavour) : base;
}
