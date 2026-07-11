/**
 * Owner-reply phrase pools (zero API), keyed by locale (en/ja/ar) and sentiment.
 *
 * Two goals shape every line here:
 *
 *  1) LOCAL SEO / GEO / AIO. Replying at all is a Google ranking signal, and the
 *     reply text is indexed and read by AI Overviews/LLMs building the business's
 *     entity graph. So replies carry the business name (always, via sign-off) and
 *     can lightly weave ONE locality phrase ({geo}) in natural place-framing. We
 *     deliberately do NOT keyword-stuff: cramming terms is the fastest way to look
 *     spammy AND robotic, which defeats both goals.
 *
 *  2) NO "AI" TELL. These must read like a real owner typed them, not a template.
 *     That means contractions, varied openers (NOT all starting with "Thank you"),
 *     specific and slightly informal warmth, and — via the engine — variable length
 *     and structure (some replies drop the closing line or the body entirely).
 *     Banned in spirit: "we truly appreciate you taking the time", "it means so
 *     much to us", "your satisfaction is our priority", "we are thrilled", and any
 *     em/en dash (normalized by the engine).
 *
 * Placeholders: {store} = business name, {theme} = detected topic noun phrase,
 * {geo} = a single locality/area phrase (owner-chosen). All substituted by engine.
 */

export type ReplyLocale = "en" | "ja" | "ar";
export type Sentiment = "positive" | "mixed" | "negative";
export type ReplyTone = "warm" | "professional";

export type Theme =
  | "staff"
  | "service"
  | "food"
  | "drink"
  | "atmosphere"
  | "cleanliness"
  | "value"
  | "wait"
  | "quality"
  | "location"
  | "experience";

export const THEME_ORDER: Theme[] = [
  "staff",
  "service",
  "food",
  "drink",
  "atmosphere",
  "cleanliness",
  "value",
  "wait",
  "quality",
  "location",
  "experience",
];

/** Per-topic detection lexicon (multilingual in one regex). "experience" is the fallback. */
export const THEME_DETECT: Record<Exclude<Theme, "experience">, RegExp> = {
  staff: /\b(staff|team|waiter|waitress|server|host(?:ess)?|reception|manager|barber|stylist|therapist|doctor|nurse|technician|barista)\b|friendly|welcoming|rude|attentive|helpful|professional|polite|スタッフ|店員|対応|接客|従業員|店長|فريق|موظف|طاقم|خدمة العملاء/i,
  service: /\bservice[ds]?\b|served|attention|efficient|slow|delay|prompt|サービス|接遇|خدمة/i,
  food: /\bfood\b|dish(?:es)?|meal|menu|taste|tasty|flavou?r|delicious|portion|cook(?:ed|ing)?|fresh|breakfast|lunch|dinner|pizza|burger|sushi|料理|味|美味|ご飯|メニュー|طعام|أكل|وجبة|طبق/i,
  drink: /coffee|latte|espresso|cappuccino|\bdrink[s]?\b|cocktail|\btea\b|wine|beer|beverage|juice|コーヒー|ドリンク|飲み物|お茶|قهوة|مشروب|شاي/i,
  atmosphere: /atmosphere|ambien(?:ce|t)|\bvibe[s]?\b|decor|music|cozy|cosy|comfortable|interior|seating|aesthetic|雰囲気|内装|居心地|空間|أجواء|ديكور|جو/i,
  cleanliness: /clean(?:liness|ed)?|hygien\w*|dirty|tidy|spotless|messy|smell|清潔|きれい|衛生|汚い|نظافة|نظيف|متسخ/i,
  value: /\bprice[sd]?\b|pricing|value|expensive|cheap|worth|overpriced|affordable|money|cost(?:ly)?|価格|値段|コスパ|高い|安い|سعر|غالي|رخيص|قيمة/i,
  wait: /\bwait(?:ed|ing)?\b|queue|\bline\b|reservation|booking|on time|too long|late|待ち|予約|時間がかか|遅い|انتظار|طابور|حجز/i,
  quality: /quality|standard|excellent|poor|amazing|great|best|wonderful|fantastic|disappoint\w*|terrible|awful|品質|最高|素晴らし|残念|ひどい|جودة|ممتاز|رائع|سيئ/i,
  location: /location|parking|\barea\b|convenient|far|central|nearby|access|立地|場所|駐車|アクセス|موقع|مواقف|قريب/i,
};

/** Noun phrase slotted into {theme}, per locale. */
export const THEME_PHRASE: Record<ReplyLocale, Record<Theme, string>> = {
  en: {
    staff: "our team",
    service: "our service",
    food: "the food",
    drink: "our drinks",
    atmosphere: "the atmosphere",
    cleanliness: "the cleanliness",
    value: "the value",
    wait: "the timing",
    quality: "the quality",
    location: "the location",
    experience: "your visit",
  },
  ja: {
    staff: "スタッフの対応",
    service: "サービス",
    food: "お料理",
    drink: "ドリンク",
    atmosphere: "店内の雰囲気",
    cleanliness: "清潔感",
    value: "価格",
    wait: "お時間",
    quality: "品質",
    location: "立地",
    experience: "今回のご来店",
  },
  ar: {
    staff: "فريقنا",
    service: "خدمتنا",
    food: "الطعام",
    drink: "مشروباتنا",
    atmosphere: "الأجواء",
    cleanliness: "النظافة",
    value: "السعر",
    wait: "الوقت",
    quality: "الجودة",
    location: "الموقع",
    experience: "زيارتك",
  },
};

// ────────────────────────────────────────────────────────────────────────────
// Pool shape
// ────────────────────────────────────────────────────────────────────────────

export type ReplyPool = {
  openWarm: string[];
  openPro: string[];
  ackTheme: string[];
  ackGeneric: string[];
  /** Natural, place-framed sentence weaving one {geo} locality (SEO). Empty for negative. */
  geoWoven: string[];
  body: string[];
  closeWarm: string[];
  closePro: string[];
  signoff: string[];
};

export type LocalePools = Record<Sentiment, ReplyPool>;

// ═════════════════════════════════════════════════════════════════ EN ══════
const EN: LocalePools = {
  positive: {
    openWarm: [
      "Thanks for the kind words, honestly made our day.",
      "Reviews like this are the best part of the job.",
      "Well, this just made our week.",
      "Really glad you had a good time, and thanks for saying so.",
      "You didn't have to leave this, and we're so glad you did.",
      "This put a big smile on the whole team.",
      "Made our day reading this, thank you.",
      "So happy you enjoyed it.",
    ],
    openPro: [
      "Thank you for the generous review.",
      "We appreciate you sharing this.",
      "Thank you, this was wonderful to read.",
      "We're grateful for your kind feedback.",
      "It's a real pleasure to read this.",
      "Thank you for the lovely review.",
    ],
    ackTheme: [
      "Really glad {theme} hit the spot for you.",
      "Great to hear {theme} stood out.",
      "Nothing we like more than hearing {theme} landed well.",
      "We put a lot into {theme}, so this means a lot.",
      "So pleased {theme} made the visit for you.",
      "Chuffed that {theme} was a highlight.",
    ],
    ackGeneric: [
      "Really glad the whole visit landed well.",
      "Great to hear you had such a good time.",
      "Sounds like everything came together, which is exactly what we go for.",
      "Nothing better than hearing a visit went this well.",
    ],
    geoWoven: [
      "We're proud to be part of {geo}, and glad you found us.",
      "Folks like you make running a place in {geo} worth it.",
      "If you're ever back around {geo}, you know where we are.",
      "Glad to have you as a neighbour here in {geo}.",
      "It's a real pleasure serving {geo}, and this is exactly why.",
      "Reviews like this are why we love being in {geo}.",
    ],
    body: [
      "Come see us again soon.",
      "We'd love to have you back.",
      "We'll aim to make the next one even better.",
      "Already looking forward to your next visit.",
      "Don't be a stranger.",
    ],
    closeWarm: [
      "Thanks again!",
      "See you soon.",
      "Take care.",
      "All the best.",
    ],
    closePro: [
      "Thank you again.",
      "We look forward to your next visit.",
      "With appreciation.",
      "Thank you for the recommendation.",
    ],
    signoff: [
      "The team at {store}",
      "{store} team",
      "Warmly, {store}",
      "{store}",
    ],
  },
  mixed: {
    openWarm: [
      "Thanks for the honest write-up, we take it on board.",
      "Appreciate you being straight with us.",
      "Thanks for the balanced review, genuinely useful.",
      "Good to hear what worked and what didn't.",
      "We really value feedback like this.",
    ],
    openPro: [
      "Thank you for the candid feedback.",
      "We appreciate the balanced review.",
      "Thank you for the constructive notes.",
      "We value the honesty here.",
    ],
    ackTheme: [
      "Glad parts of it worked, and point taken on {theme}.",
      "We hear you on {theme}, and we'll tighten it up.",
      "Fair point on {theme}, and we'll sort it.",
      "Thanks for flagging {theme}, we're already looking at it.",
    ],
    ackGeneric: [
      "Glad some of it landed, and we hear you on the rest.",
      "We'll take the good and fix what missed.",
      "Point taken, and we'll do better on the rest.",
      "Helpful to know what worked and what we can sharpen.",
    ],
    geoWoven: [
      "We want to be the spot you count on in {geo}, and we'll keep at it.",
      "Getting it right for our {geo} regulars matters to us.",
      "We're here for the long run in {geo}, and we'll earn the next visit.",
    ],
    body: [
      "We'd love another shot at it.",
      "Give us another go, we think you'll notice the difference.",
      "We'll put this right next time.",
      "Hope you'll let us make it up to you.",
    ],
    closeWarm: [
      "Thanks again.",
      "Hope to see you back.",
      "We appreciate you.",
    ],
    closePro: [
      "Thank you for helping us improve.",
      "We hope to serve you again.",
      "Thank you again.",
    ],
    signoff: [
      "The team at {store}",
      "{store} team",
      "{store}",
    ],
  },
  negative: {
    openWarm: [
      "Really sorry this one missed the mark.",
      "Sorry to hear this, and thanks for telling us.",
      "This isn't how we want anyone to leave, our apologies.",
      "We dropped the ball here, and we're sorry.",
      "Sorry, this genuinely isn't like us.",
    ],
    openPro: [
      "We're sorry your visit fell short.",
      "Thank you for the feedback, and our apologies for the experience.",
      "We regret that we didn't get this right.",
      "We take this seriously, and we apologize.",
    ],
    ackTheme: [
      "You're right about {theme}, and it's not good enough.",
      "{theme} isn't where it should be, and that's on us.",
      "We're taking a hard look at {theme} after reading this.",
      "What you describe about {theme} isn't our standard.",
    ],
    ackGeneric: [
      "This isn't the standard we hold ourselves to, and we own it.",
      "That's not the experience we intend, and we take responsibility.",
      "We're looking into exactly what went wrong.",
      "This falls short of what we expect of ourselves.",
    ],
    geoWoven: [],
    body: [
      "We'd like to put this right, so please get in touch with us directly.",
      "Reach out to us directly and we'll do our best to fix it.",
      "Please contact us directly so we can make it right.",
      "We'd welcome the chance to fix this, please get in touch.",
    ],
    closeWarm: [
      "Thanks for giving us the chance to do better.",
      "We're grateful for the honesty, and we'll improve.",
      "We hope you'll let us make it up to you.",
    ],
    closePro: [
      "Thank you for bringing this to our attention.",
      "We're committed to doing better.",
      "We appreciate the chance to address it.",
    ],
    signoff: [
      "The team at {store}",
      "The management at {store}",
      "{store}",
    ],
  },
};

// ═════════════════════════════════════════════════════════════════ JA ══════
const JA: LocalePools = {
  positive: {
    openWarm: [
      "嬉しいお言葉、本当にありがとうございます。",
      "こういうレビューをいただけるのが、この仕事の一番の醍醐味です。",
      "読んでいて思わず笑顔になりました。",
      "楽しんでいただけたようで、こちらまで嬉しくなりました。",
      "わざわざ書いてくださって、スタッフ一同大喜びです。",
      "ご来店ありがとうございました、そして嬉しいご感想に感謝です。",
    ],
    openPro: [
      "この度は温かいご感想をありがとうございます。",
      "嬉しいレビューを頂戴し、御礼申し上げます。",
      "お褒めのお言葉、大変光栄です。",
      "ご投稿いただき、誠にありがとうございます。",
    ],
    ackTheme: [
      "{theme}を気に入っていただけて、本当に嬉しいです。",
      "{theme}が印象に残ったとのこと、何よりの励みになります。",
      "{theme}にはこだわっているので、そう言っていただけると報われます。",
      "{theme}をお褒めいただき、ありがとうございます。",
    ],
    ackGeneric: [
      "全体を楽しんでいただけたようで、本当に嬉しいです。",
      "良いひとときをお過ごしいただけて何よりです。",
      "こういうご感想が、日々の一番の励みです。",
    ],
    geoWoven: [
      "{geo}でお店を続けてこられるのも、こうしたお声のおかげです。",
      "{geo}にお越しの際は、ぜひまた覗いてください。",
      "{geo}で愛されるお店を目指して、これからも頑張ります。",
      "{geo}の皆さんに支えられているのを実感します。",
    ],
    body: [
      "またお待ちしております。",
      "ぜひまた遊びに来てください。",
      "次はさらに良い時間にできるよう頑張ります。",
      "またお会いできるのを楽しみにしています。",
    ],
    closeWarm: [
      "改めて、ありがとうございました。",
      "またお会いしましょう。",
      "どうぞお気をつけて。",
    ],
    closePro: [
      "またのお越しをお待ちしております。",
      "重ねて御礼申し上げます。",
      "今後ともよろしくお願いいたします。",
    ],
    signoff: [
      "{store} スタッフ一同",
      "{store} 一同",
      "{store}",
    ],
  },
  mixed: {
    openWarm: [
      "正直なご感想、ありがとうございます。しっかり受け止めます。",
      "率直に教えていただけて助かります。",
      "良い点も気になる点も書いてくださって感謝です。",
      "こうしたお声が一番の改善のヒントになります。",
    ],
    openPro: [
      "忌憚のないご意見をありがとうございます。",
      "公平なご評価に感謝いたします。",
      "建設的なご感想をいただき御礼申し上げます。",
    ],
    ackTheme: [
      "良かった点を嬉しく思う一方、{theme}のご指摘はしっかり直します。",
      "{theme}についてはおっしゃる通りで、改善に取り組みます。",
      "{theme}のお声、社内で共有して見直します。",
    ],
    ackGeneric: [
      "楽しんでいただけた点は嬉しく、至らぬ点は真摯に受け止めます。",
      "良い点は伸ばし、足りない点は必ず直します。",
      "いただいたお声を大切に改善します。",
    ],
    geoWoven: [
      "{geo}で信頼いただけるお店になれるよう、いただいたお声を活かします。",
      "{geo}の皆さんに安心して通っていただけるよう努めます。",
    ],
    body: [
      "ぜひもう一度お試しいただけると嬉しいです。",
      "次回は違いを感じていただけるよう頑張ります。",
      "挽回の機会をいただけますと幸いです。",
    ],
    closeWarm: [
      "また機会をいただけたら嬉しいです。",
      "ありがとうございました。",
      "またのお越しをお待ちしています。",
    ],
    closePro: [
      "改善に努めてまいります。",
      "またの機会を賜れれば幸いです。",
      "重ねて御礼申し上げます。",
    ],
    signoff: [
      "{store} スタッフ一同",
      "{store} 一同",
      "{store}",
    ],
  },
  negative: {
    openWarm: [
      "この度は残念な思いをさせてしまい、申し訳ありませんでした。",
      "ご不快な思いをおかけし、心よりお詫びします。",
      "教えてくださってありがとうございます。そして、申し訳ありませんでした。",
      "本来の私どもらしくない対応で、深くお詫びします。",
    ],
    openPro: [
      "この度はご期待に沿えず、深くお詫び申し上げます。",
      "ご意見をいただき、また至らぬ点があり誠に申し訳ございませんでした。",
      "私どもの不行き届きにより、心よりお詫び申し上げます。",
    ],
    ackTheme: [
      "{theme}についてはおっしゃる通りで、本来あるべき水準ではありません。",
      "{theme}は私どもの反省点であり、責任を持って改善します。",
      "{theme}のお声を重く受け止めています。",
    ],
    ackGeneric: [
      "本来あるべき水準に達しておらず、私どもの責任です。",
      "ご指摘は反省すべき点であり、真摯に受け止めます。",
      "何が至らなかったのか、しっかり見直します。",
    ],
    geoWoven: [],
    body: [
      "改善のため、差し支えなければ直接ご連絡いただけますと幸いです。",
      "きちんと対応したく、ぜひ一度ご連絡ください。",
      "この件を適切に解決したく、直接のご連絡をお待ちしています。",
    ],
    closeWarm: [
      "貴重なお声、ありがとうございました。",
      "必ず改善します。",
      "挽回の機会をいただけますと幸いです。",
    ],
    closePro: [
      "ご指摘、誠にありがとうございました。",
      "再発防止に努めてまいります。",
      "改善に真摯に取り組みます。",
    ],
    signoff: [
      "{store} スタッフ一同",
      "{store} 一同",
      "{store} 店主",
    ],
  },
};

// ═════════════════════════════════════════════════════════════════ AR ══════
const AR: LocalePools = {
  positive: {
    openWarm: [
      "شكرًا على كلماتك الطيبة، أسعدت يومنا فعلًا.",
      "مثل هذه التقييمات هي أجمل ما في عملنا.",
      "سعدنا كثيرًا بقراءة هذا.",
      "يسعدنا أنك قضيت وقتًا جميلًا، وشكرًا لقولك ذلك.",
      "لم يكن عليك كتابة هذا، ونحن ممتنّون أنك فعلت.",
    ],
    openPro: [
      "نشكرك على هذا التقييم الكريم.",
      "نقدّر لك مشاركتنا رأيك.",
      "شكرًا لك، سعدنا بقراءة هذا.",
      "ممتنّون لملاحظاتك الطيبة.",
    ],
    ackTheme: [
      "يسعدنا حقًا أن {theme} نال إعجابك.",
      "جميل أن نعرف أن {theme} ترك انطباعًا لديك.",
      "نبذل جهدًا كبيرًا في {theme}، لذا يعني لنا هذا الكثير.",
      "سعداء أن {theme} كان من أبرز ما في زيارتك.",
    ],
    ackGeneric: [
      "يسعدنا أن الزيارة كلها كانت جميلة.",
      "جميل أن نعرف أنك قضيت وقتًا ممتعًا.",
      "مثل هذه الملاحظات هي أكبر تشجيع لنا.",
    ],
    geoWoven: [
      "نفخر بأننا جزء من {geo}، وسعداء أنك وجدتنا.",
      "زبائن مثلك يجعلون العمل في {geo} يستحق العناء.",
      "إن مررت بـ{geo} مجددًا، فأنت تعرف مكاننا.",
      "سعداء بوجودك جارًا لنا في {geo}.",
    ],
    body: [
      "ننتظر زيارتك القادمة.",
      "يسعدنا رؤيتك مرة أخرى.",
      "سنسعى لأن تكون المرة القادمة أفضل.",
      "لا تكن غريبًا.",
    ],
    closeWarm: [
      "شكرًا مجددًا!",
      "إلى اللقاء قريبًا.",
      "دمت بخير.",
    ],
    closePro: [
      "شكرًا لك مرة أخرى.",
      "نتطلّع إلى زيارتك القادمة.",
      "مع التقدير.",
    ],
    signoff: [
      "فريق {store}",
      "{store}",
    ],
  },
  mixed: {
    openWarm: [
      "شكرًا على صراحتك، نأخذها بعين الاعتبار.",
      "نقدّر وضوحك معنا.",
      "شكرًا على التقييم المتوازن، مفيد حقًا.",
      "من الجيد أن نعرف ما نجح وما لم ينجح.",
    ],
    openPro: [
      "نشكرك على ملاحظاتك الصريحة.",
      "نقدّر التقييم المتوازن.",
      "شكرًا على ملاحظاتك البنّاءة.",
    ],
    ackTheme: [
      "يسعدنا أن جزءًا نجح، ونأخذ ملاحظتك حول {theme} على محمل الجد.",
      "نتفق معك بشأن {theme}، وسنحسّنه.",
      "شكرًا لإشارتك إلى {theme}، ننظر فيه بالفعل.",
    ],
    ackGeneric: [
      "يسعدنا أن جزءًا نجح، ونسمعك بشأن الباقي.",
      "سنأخذ الجيد ونصلح ما قصّر.",
      "مفيد أن نعرف ما نجح وما يمكن تحسينه.",
    ],
    geoWoven: [
      "نريد أن نكون المكان الذي تعتمد عليه في {geo}، وسنواصل العمل على ذلك.",
      "أن نُحسن لزبائننا في {geo} أمر يهمّنا.",
    ],
    body: [
      "نودّ فرصة أخرى.",
      "امنحنا فرصة أخرى وستلاحظ الفرق.",
      "سنصحّح ذلك في المرة القادمة.",
    ],
    closeWarm: [
      "شكرًا مجددًا.",
      "نأمل أن نراك.",
      "نقدّرك.",
    ],
    closePro: [
      "شكرًا لمساعدتنا على التحسّن.",
      "نأمل خدمتك مجددًا.",
      "شكرًا لك.",
    ],
    signoff: [
      "فريق {store}",
      "{store}",
    ],
  },
  negative: {
    openWarm: [
      "نأسف حقًا لأن هذه الزيارة لم تكن كما ينبغي.",
      "نأسف لسماع ذلك، وشكرًا لإخبارنا.",
      "هذه ليست الطريقة التي نريد أن يغادر بها أحد، نعتذر.",
      "لقد قصّرنا هنا، ونعتذر.",
    ],
    openPro: [
      "نعتذر لأن زيارتك لم ترقَ إلى التوقعات.",
      "شكرًا على ملاحظاتك، ونأسف للتجربة.",
      "نأخذ الأمر بجدية، ونعتذر.",
    ],
    ackTheme: [
      "أنت محقّ بشأن {theme}، وهو ليس بالمستوى الكافي.",
      "{theme} ليس حيث يجب أن يكون، وهذا على عاتقنا.",
      "ننظر بجدية في {theme} بعد قراءة هذا.",
    ],
    ackGeneric: [
      "هذا ليس المعيار الذي نلتزم به، ونتحمّل مسؤوليته.",
      "ليست هذه التجربة التي نقصدها، ونتحمّل المسؤولية.",
      "نبحث فيما حدث بالضبط.",
    ],
    geoWoven: [],
    body: [
      "نودّ تصحيح الأمر، فيرجى التواصل معنا مباشرة.",
      "تواصل معنا مباشرة وسنبذل جهدنا لإصلاح ذلك.",
      "يرجى التواصل معنا مباشرة لنصحّح الأمر.",
    ],
    closeWarm: [
      "شكرًا على منحنا فرصة للتحسّن.",
      "نقدّر صراحتك، وسنتحسّن.",
    ],
    closePro: [
      "شكرًا لإطلاعنا على الأمر.",
      "نحن ملتزمون بأن نكون أفضل.",
    ],
    signoff: [
      "فريق {store}",
      "إدارة {store}",
      "{store}",
    ],
  },
};

export const REPLY_POOLS: Record<ReplyLocale, LocalePools> = { en: EN, ja: JA, ar: AR };
