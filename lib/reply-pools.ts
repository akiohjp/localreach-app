/**
 * Owner-reply phrase pools (zero API), keyed by locale (en/ja/ar) and sentiment.
 *
 * The reply engine reads the guest's review, pulls out the SPECIFIC things they
 * praised or complained about (e.g. "the matcha croissant", "the wait"), and
 * reacts to them by name. These pools supply the surrounding, human owner voice.
 *
 * Two standing goals:
 *  1) LOCAL SEO / GEO / AIO — the business name (always, via sign-off) plus, when
 *     the owner sets a real neighbourhood, ONE locality phrase woven naturally
 *     ({geo}) on positive/mixed replies. Never keyword-stuffed, never on apologies.
 *  2) NO "AI" TELL — contractions, varied openers (not all "Thank you"), specific
 *     reactions to THIS review, and (via the engine) variable length/structure.
 *     No em/en dashes (normalized by the engine).
 *
 * Placeholders: {store} business name, {spec}/{spec2} a specific guest phrase
 * (bare noun; templates supply "the"), {theme} a topic noun phrase (carries its
 * own article), {geo} a locality.
 */

export type ReplyLocale = "en" | "ja" | "ar";
export type Sentiment = "positive" | "mixed" | "negative";
export type ReplyTone = "warm" | "professional";

export type Theme =
  | "staff" | "service" | "food" | "drink" | "atmosphere" | "cleanliness"
  | "value" | "wait" | "quality" | "location" | "experience";

export const THEME_ORDER: Theme[] = [
  "staff", "service", "food", "drink", "atmosphere", "cleanliness",
  "value", "wait", "quality", "location", "experience",
];

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

export const THEME_PHRASE: Record<ReplyLocale, Record<Theme, string>> = {
  en: { staff: "our team", service: "our service", food: "the food", drink: "our drinks", atmosphere: "the atmosphere", cleanliness: "the cleanliness", value: "the value", wait: "the timing", quality: "the quality", location: "the location", experience: "your visit" },
  ja: { staff: "スタッフの対応", service: "サービス", food: "お料理", drink: "ドリンク", atmosphere: "店内の雰囲気", cleanliness: "清潔感", value: "価格", wait: "お時間", quality: "品質", location: "立地", experience: "今回のご来店" },
  ar: { staff: "فريقنا", service: "خدمتنا", food: "الطعام", drink: "مشروباتنا", atmosphere: "الأجواء", cleanliness: "النظافة", value: "السعر", wait: "الوقت", quality: "الجودة", location: "الموقع", experience: "زيارتك" },
};

// ── Extraction lexicons (EN) ────────────────────────────────────────────────
export const EN_POS_ADJ = "amazing|great|excellent|delicious|lovely|wonderful|fantastic|perfect|friendly|attentive|fresh|cozy|cosy|comfortable|beautiful|tasty|incredible|superb|nice|good|best|outstanding|helpful|welcoming|clean|generous|reasonable|quick|fast|warm|charming|authentic|flavourful|flavorful|prompt|professional|efficient|impeccable|spotless|relaxing";
export const EN_NEG_ADJ = "cold|slow|rude|dirty|late|wrong|terrible|awful|poor|overpriced|expensive|bad|disappointing|unfriendly|messy|stale|burnt|bland|tasteless|noisy|unprofessional|careless|rushed|dry|greasy|soggy|undercooked|overcooked";
/** Generic nouns that read as filler when echoed back; never use as a {spec}. */
export const SPEC_STOP = new Set([
  "place", "spot", "time", "times", "everything", "experience", "visit", "day",
  "night", "thing", "things", "one", "lot", "bit", "moment", "area", "part",
  "here", "stuff", "way", "reason", "people", "guys", "us", "me", "it", "they",
]);

// ── Pool shape ──────────────────────────────────────────────────────────────
export type ReplyPool = {
  open: string[];
  reactSpec: string[];     // {spec}
  reactPair: string[];     // {spec} {spec2}
  reactTheme: string[];    // {theme}
  reactGeneric: string[];
  warm: string[];          // optional extra human beat (pos/mixed)
  geoWoven: string[];      // {geo} (pos/mixed)
  body: string[];          // invite-back (pos/mixed) | make-it-right (neg)
  close: string[];
  signoff: string[];       // {store}
};
export type LocalePools = Record<Sentiment, ReplyPool>;

// ═══════════════════════════════════════════════════════════════════ EN ════
const EN: LocalePools = {
  positive: {
    open: [
      "Thanks for the kind words, honestly made our day.", "Reviews like this are the best part of the job.",
      "Well, this just made our week.", "Really glad you had a good time, and thanks for saying so.",
      "You didn't have to leave this, and we're so glad you did.", "This put a big smile on the whole team.",
      "Made our day reading this, thank you.", "So happy you enjoyed it.", "Thank you for the lovely review.",
      "What a great thing to wake up to, thank you.", "Cheers for taking a minute to write this.",
      "We really appreciate you sharing this.",
    ],
    reactSpec: [
      "So glad the {spec} hit the spot for you.", "Really pleased the {spec} landed the way it did.",
      "Great to hear the {spec} was a highlight.", "Nothing makes us happier than hearing the {spec} was spot on.",
      "We're proud of the {spec}, so thank you for calling it out.", "Lovely to hear the {spec} did the trick.",
      "The {spec} is something we care a lot about, so this means a lot.", "Chuffed the {spec} lived up to it.",
      "Happy the {spec} was as good as we hoped.", "Good to know the {spec} stood out for you.",
    ],
    reactPair: [
      "So glad the {spec} and the {spec2} both landed for you.", "Great to hear the {spec} and the {spec2} hit the mark.",
      "Nothing better than hearing the {spec} and the {spec2} both stood out.", "Really pleased both the {spec} and the {spec2} did the job.",
      "The {spec} and the {spec2} are things we work hard on, so thank you for noticing both.",
    ],
    reactTheme: [
      "Really glad {theme} made an impression.", "Great to hear {theme} stood out.",
      "We put a lot into {theme}, so this means a lot.", "So pleased {theme} made the visit for you.",
      "Nothing we like more than hearing {theme} landed well.",
    ],
    reactGeneric: [
      "Really glad the whole visit landed well.", "Great to hear you had such a good time.",
      "Sounds like it all came together, which is exactly what we go for.", "Nothing better than hearing a visit went this well.",
    ],
    warm: [
      "It's guests like you that make the long days worth it.", "We'll be sure to pass this on to the team.",
      "Little notes like this keep us going.", "You've set the bar for the next visit now.",
    ],
    geoWoven: [
      "We're proud to be part of {geo}, and glad you found us.", "Folks like you make being in {geo} worth it.",
      "If you're ever back around {geo}, you know where we are.", "Glad to have you as a neighbour here in {geo}.",
      "Reviews like this are why we love being in {geo}.",
    ],
    body: [
      "Come see us again soon.", "We'd love to have you back.", "We'll aim to make the next one even better.",
      "Already looking forward to your next visit.", "Don't be a stranger.", "Hope to see you again before long.",
    ],
    close: ["Thanks again!", "See you soon.", "Take care.", "All the best.", "Cheers."],
    signoff: ["The team at {store}", "{store} team", "Warmly, {store}", "{store}"],
  },
  mixed: {
    open: [
      "Thanks for the honest write-up, we take it on board.", "Appreciate you being straight with us.",
      "Thanks for the balanced review, genuinely useful.", "Good to hear what worked and what didn't.",
      "We really value feedback like this.", "Thanks for taking the time to lay it all out.",
    ],
    reactSpec: [
      "Point taken on the {spec}, we'll sort it.", "We hear you on the {spec}, and we'll tighten it up.",
      "Fair shout on the {spec}, that's on us to fix.", "Thanks for flagging the {spec}, we're already on it.",
    ],
    reactPair: [
      "Really glad the {spec} worked for you, and we're sorry the {spec2} fell short.",
      "Great that the {spec} landed, and point taken on the {spec2}.",
      "Glad the {spec} hit the mark, though we'll fix the {spec2}.",
      "Happy the {spec} was a highlight, and we hear you on the {spec2}.",
    ],
    reactTheme: [
      "Glad parts of it worked, and we hear you on {theme}.", "Good to know {theme} left an impression, mixed as it was.",
    ],
    reactGeneric: [
      "Glad some of it landed, and we hear you on the rest.", "We'll take the good and fix what missed.",
      "Point taken, and we'll do better on the rest.", "Helpful to know what worked and what we can sharpen.",
    ],
    warm: [
      "We'd genuinely rather hear this than not.", "This is the kind of note that actually changes things here.",
    ],
    geoWoven: [
      "We want to be the spot you count on in {geo}, and we'll keep at it.", "Getting it right for our {geo} regulars matters to us.",
    ],
    body: [
      "We'd love another shot at it.", "Give us another go, we think you'll notice the difference.",
      "We'll put this right next time.", "Hope you'll let us make it up to you.",
    ],
    close: ["Thanks again.", "Hope to see you back.", "We appreciate you."],
    signoff: ["The team at {store}", "{store} team", "{store}"],
  },
  negative: {
    open: [
      "Really sorry this one missed the mark.", "Sorry to hear this, and thanks for telling us.",
      "This isn't how we want anyone to leave, our apologies.", "We dropped the ball here, and we're sorry.",
      "Sorry, this genuinely isn't like us.", "This one's on us, and we're sorry.",
    ],
    reactSpec: [
      "You're right about the {spec}, and it's not good enough.", "We're sorry the {spec} let you down.",
      "The {spec} should have been better, and that's on us.", "We hate that the {spec} missed the mark for you.",
      "There's no excuse for the {spec}, and we're looking into it.",
    ],
    reactPair: [
      "We're sorry about both the {spec} and the {spec2}, neither is our standard.",
      "The {spec} and the {spec2} both fell short, and that's on us.",
    ],
    reactTheme: [
      "You're right about {theme}, and it's not where it should be.", "{theme} isn't our standard, and we own that.",
      "We're taking a hard look at {theme} after reading this.",
    ],
    reactGeneric: [
      "This isn't the standard we hold ourselves to, and we own it.", "That's not the experience we intend, and we take responsibility.",
      "We're looking into exactly what went wrong.", "This falls short of what we expect of ourselves.",
    ],
    warm: [],
    geoWoven: [],
    body: [
      "We'd like to put this right, so please get in touch with us directly.", "Reach out to us directly and we'll do our best to fix it.",
      "Please contact us directly so we can make it right.", "We'd welcome the chance to fix this, please get in touch.",
    ],
    close: ["Thanks for giving us the chance to do better.", "We're grateful for the honesty, and we'll improve.", "We hope you'll let us make it up to you."],
    signoff: ["The team at {store}", "The management at {store}", "{store}"],
  },
};

// ═══════════════════════════════════════════════════════════════════ JA ════
const JA: LocalePools = {
  positive: {
    open: [
      "嬉しいお言葉、本当にありがとうございます。", "こういうレビューをいただけるのが、この仕事の一番の励みです。",
      "読んでいて思わず笑顔になりました。", "楽しんでいただけたようで、こちらまで嬉しくなりました。",
      "わざわざ書いてくださって、スタッフ一同大喜びです。", "ご来店とお褒めのお言葉、心より感謝です。",
      "朝からとても嬉しいご感想をありがとうございます。", "お褒めいただき光栄です。",
    ],
    reactSpec: [
      "{spec}を気に入っていただけて、本当に嬉しいです。", "{spec}が印象に残ったとのこと、何よりの励みになります。",
      "{spec}にはこだわっているので、そう言っていただけると報われます。", "{spec}をお褒めいただき、ありがとうございます。",
      "{spec}をそう感じていただけたなら、頑張った甲斐があります。",
    ],
    reactPair: [
      "{spec}も{spec2}も気に入っていただけて、本当に嬉しいです。", "{spec}と{spec2}、どちらもお褒めいただき光栄です。",
      "{spec}に加えて{spec2}まで喜んでいただけて、励みになります。",
    ],
    reactTheme: [
      "{theme}にご満足いただけたようで、大変嬉しいです。", "{theme}が印象に残ったとのこと、何よりです。",
      "{theme}にはこだわっているので、そう言っていただけると報われます。",
    ],
    reactGeneric: [
      "全体を楽しんでいただけたようで、本当に嬉しいです。", "良いひとときをお過ごしいただけて何よりです。",
      "こういうご感想が、日々の一番の励みです。",
    ],
    warm: ["いただいたお言葉、スタッフにも共有いたします。", "明日からの活力をいただきました。"],
    geoWoven: [
      "{geo}でお店を続けてこられるのも、こうしたお声のおかげです。", "{geo}にお越しの際は、ぜひまた覗いてください。",
      "{geo}で愛されるお店を目指して、これからも頑張ります。",
    ],
    body: ["またお待ちしております。", "ぜひまた遊びに来てください。", "次はさらに良い時間にできるよう頑張ります。", "またお会いできるのを楽しみにしています。"],
    close: ["改めて、ありがとうございました。", "またお会いしましょう。", "どうぞお気をつけて。"],
    signoff: ["{store} スタッフ一同", "{store} 一同", "{store}"],
  },
  mixed: {
    open: [
      "正直なご感想、ありがとうございます。しっかり受け止めます。", "率直に教えていただけて助かります。",
      "良い点も気になる点も書いてくださって感謝です。", "こうしたお声が一番の改善のヒントになります。",
    ],
    reactSpec: [
      "{spec}のご指摘、しっかり改善します。", "{spec}についてはおっしゃる通りで、見直します。",
      "{spec}のお声、社内で共有いたします。",
    ],
    reactPair: [
      "{spec}を気に入っていただけた一方、{spec2}は至らず申し訳ありません。改善します。",
      "{spec}はお褒めいただき嬉しく、{spec2}のご指摘は真摯に受け止めます。",
      "{spec}が良かったとのこと嬉しく思う反面、{spec2}は必ず直します。",
    ],
    reactTheme: ["良かった点を嬉しく思う一方、{theme}のご指摘は真摯に受け止めます。", "{theme}については見直してまいります。"],
    reactGeneric: [
      "楽しんでいただけた点は嬉しく、至らぬ点は真摯に受け止めます。", "良い点は伸ばし、足りない点は必ず直します。",
      "いただいたお声を大切に改善します。",
    ],
    warm: ["こうしたお声こそ、私どもが変わるきっかけになります。"],
    geoWoven: ["{geo}で信頼いただけるお店になれるよう、いただいたお声を活かします。", "{geo}の皆さんに安心して通っていただけるよう努めます。"],
    body: ["ぜひもう一度お試しいただけると嬉しいです。", "次回は違いを感じていただけるよう頑張ります。", "挽回の機会をいただけますと幸いです。"],
    close: ["また機会をいただけたら嬉しいです。", "ありがとうございました。", "またのお越しをお待ちしています。"],
    signoff: ["{store} スタッフ一同", "{store} 一同", "{store}"],
  },
  negative: {
    open: [
      "この度は残念な思いをさせてしまい、申し訳ありませんでした。", "ご不快な思いをおかけし、心よりお詫びします。",
      "教えてくださってありがとうございます。そして、申し訳ありませんでした。", "本来の私どもらしくない対応で、深くお詫びします。",
    ],
    reactSpec: [
      "{spec}については、おっしゃる通り私どもの至らぬ点です。", "{spec}でご不便をおかけし、申し訳ありません。",
      "{spec}は本来の水準ではなく、責任を持って改善します。",
    ],
    reactPair: ["{spec}も{spec2}も本来あるべき姿ではなく、深くお詫びします。"],
    reactTheme: ["{theme}についてはおっしゃる通りで、本来あるべき水準ではありません。", "{theme}は私どもの反省点であり、必ず改善します。"],
    reactGeneric: [
      "本来あるべき水準に達しておらず、私どもの責任です。", "ご指摘は反省すべき点であり、真摯に受け止めます。",
      "何が至らなかったのか、しっかり見直します。",
    ],
    warm: [],
    geoWoven: [],
    body: ["改善のため、差し支えなければ直接ご連絡いただけますと幸いです。", "きちんと対応したく、ぜひ一度ご連絡ください。", "この件を適切に解決したく、直接のご連絡をお待ちしています。"],
    close: ["貴重なお声、ありがとうございました。", "必ず改善します。", "挽回の機会をいただけますと幸いです。"],
    signoff: ["{store} スタッフ一同", "{store} 一同", "{store} 店主"],
  },
};

// ═══════════════════════════════════════════════════════════════════ AR ════
const AR: LocalePools = {
  positive: {
    open: [
      "شكرًا على كلماتك الطيبة، أسعدت يومنا فعلًا.", "مثل هذه التقييمات هي أجمل ما في عملنا.",
      "سعدنا كثيرًا بقراءة هذا.", "يسعدنا أنك قضيت وقتًا جميلًا، وشكرًا لقولك ذلك.",
      "لم يكن عليك كتابة هذا، ونحن ممتنّون أنك فعلت.", "شكرًا لتخصيص وقتك لكتابة هذا.",
    ],
    reactSpec: [
      "يسعدنا حقًا أن {spec} نال إعجابك.", "جميل أن نعرف أن {spec} كان مميزًا لك.",
      "نبذل جهدًا كبيرًا في {spec}، لذا يعني لنا هذا الكثير.", "سعداء أن {spec} كان كما تمنيت.",
    ],
    reactPair: ["يسعدنا أن كلًا من {spec} و{spec2} نال إعجابك.", "سعداء أن {spec} و{spec2} تركا انطباعًا جيدًا لديك."],
    reactTheme: ["يسعدنا أن {theme} ترك انطباعًا جيدًا.", "نبذل جهدًا كبيرًا في {theme}، لذا يعني لنا هذا الكثير."],
    reactGeneric: ["يسعدنا أن الزيارة كلها كانت جميلة.", "جميل أن نعرف أنك قضيت وقتًا ممتعًا.", "مثل هذه الملاحظات هي أكبر تشجيع لنا."],
    warm: ["سنشارك كلماتك مع الفريق.", "مثل هذه الملاحظات تدفعنا للأمام."],
    geoWoven: ["نفخر بأننا جزء من {geo}، وسعداء أنك وجدتنا.", "إن مررت بـ{geo} مجددًا، فأنت تعرف مكاننا.", "سعداء بوجودك جارًا لنا في {geo}."],
    body: ["ننتظر زيارتك القادمة.", "يسعدنا رؤيتك مرة أخرى.", "سنسعى لأن تكون المرة القادمة أفضل.", "لا تكن غريبًا."],
    close: ["شكرًا مجددًا!", "إلى اللقاء قريبًا.", "دمت بخير."],
    signoff: ["فريق {store}", "{store}"],
  },
  mixed: {
    open: ["شكرًا على صراحتك، نأخذها بعين الاعتبار.", "نقدّر وضوحك معنا.", "شكرًا على التقييم المتوازن، مفيد حقًا.", "من الجيد أن نعرف ما نجح وما لم ينجح."],
    reactSpec: ["نأخذ ملاحظتك حول {spec} على محمل الجد.", "نتفق معك بشأن {spec}، وسنحسّنه.", "شكرًا لإشارتك إلى {spec}، ننظر فيه بالفعل."],
    reactPair: ["يسعدنا أن {spec} نال إعجابك، ونأسف لأن {spec2} لم يكن بالمستوى. سنحسّنه.", "سعداء أن {spec} كان جيدًا، ونأخذ ملاحظة {spec2} على محمل الجد."],
    reactTheme: ["يسعدنا أن جزءًا نجح، ونأخذ ملاحظتك حول {theme} على محمل الجد."],
    reactGeneric: ["يسعدنا أن جزءًا نجح، ونسمعك بشأن الباقي.", "سنأخذ الجيد ونصلح ما قصّر.", "مفيد أن نعرف ما نجح وما يمكن تحسينه."],
    warm: ["مثل هذه الملاحظات هي ما يجعلنا نتطور."],
    geoWoven: ["نريد أن نكون المكان الذي تعتمد عليه في {geo}، وسنواصل العمل على ذلك.", "أن نُحسن لزبائننا في {geo} أمر يهمّنا."],
    body: ["نودّ فرصة أخرى.", "امنحنا فرصة أخرى وستلاحظ الفرق.", "سنصحّح ذلك في المرة القادمة."],
    close: ["شكرًا مجددًا.", "نأمل أن نراك.", "نقدّرك."],
    signoff: ["فريق {store}", "{store}"],
  },
  negative: {
    open: ["نأسف حقًا لأن هذه الزيارة لم تكن كما ينبغي.", "نأسف لسماع ذلك، وشكرًا لإخبارنا.", "هذه ليست الطريقة التي نريد أن يغادر بها أحد، نعتذر.", "لقد قصّرنا هنا، ونعتذر."],
    reactSpec: ["أنت محقّ بشأن {spec}، وهو ليس بالمستوى الكافي.", "نأسف لأن {spec} خذلك.", "لا عذر بشأن {spec}، ونحن ننظر في الأمر."],
    reactPair: ["نأسف بشأن كلٍّ من {spec} و{spec2}، وليس هذا معيارنا."],
    reactTheme: ["أنت محقّ بشأن {theme}، وهو ليس حيث يجب أن يكون.", "{theme} ليس معيارنا، ونتحمّل ذلك."],
    reactGeneric: ["هذا ليس المعيار الذي نلتزم به، ونتحمّل مسؤوليته.", "ليست هذه التجربة التي نقصدها، ونتحمّل المسؤولية.", "نبحث فيما حدث بالضبط."],
    warm: [],
    geoWoven: [],
    body: ["نودّ تصحيح الأمر، فيرجى التواصل معنا مباشرة.", "تواصل معنا مباشرة وسنبذل جهدنا لإصلاح ذلك.", "يرجى التواصل معنا مباشرة لنصحّح الأمر."],
    close: ["شكرًا على منحنا فرصة للتحسّن.", "نقدّر صراحتك، وسنتحسّن."],
    signoff: ["فريق {store}", "إدارة {store}", "{store}"],
  },
};

export const REPLY_POOLS: Record<ReplyLocale, LocalePools> = { en: EN, ja: JA, ar: AR };
