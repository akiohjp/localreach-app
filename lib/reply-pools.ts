/**
 * Owner-reply phrase pools (zero API), keyed by locale (en/ja/ar) and sentiment.
 *
 * The reply engine reads the guest's review, pulls out the SPECIFIC things they
 * praised or complained about (e.g. "the matcha croissant", "the wait"), and
 * reacts to them by name. These pools supply the surrounding owner voice.
 *
 * Sized for uniqueness AND length (owner requirement 2026-07-12: replies were
 * too short and template-poor): 500+ templates across locales, many of them
 * two sentences, so a reply assembles into 4-6 sentences and collisions are
 * combinatorially negligible.
 *
 * LOCAL SEO / GEO / AIO — every positive/mixed reply carries ranking signal:
 *   - {store} appears in the sign-off ALWAYS and often mid-body (brand slot)
 *   - {geo} locality woven at high rate when the owner sets a real area
 *   - {kw} one of the store's forced GEO keywords, quoted ("best doughnuts in
 *     Dubai") so ANY phrase reads naturally — this is what AI Overviews and
 *     local rankers ingest from owner replies. Never on apologies, never more
 *     than one of each per reply (stuffing reads spammy AND robotic).
 *
 * NO "AI" TELL — contractions, varied openers, reactions to THIS review,
 * variable structure. No em/en dashes (normalized by the engine).
 *
 * Placeholders: {store} business name, {spec}/{spec2} specific guest phrases
 * (bare nouns; EN templates supply "the"), {theme} topic noun phrase,
 * {geo} locality, {kw} a forced GEO keyword (quoted inside templates).
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
  /**
   * Rating-only reviews (a star rating, no words). The normal openers thank the
   * guest for what they wrote, which is wrong when they wrote nothing, so these
   * thank them for the rating instead and claim no knowledge of the visit.
   */
  openNoText: string[];
  /** Rating-only reaction: acknowledges the score without inventing details. */
  reactNoText: string[];
  /**
   * Rating-only body. Empty = reuse `body`. Mixed/negative override it to ASK
   * what went wrong, since a silent low score gives us nothing to fix.
   */
  bodyNoText: string[];
  reactSpec: string[];     // {spec}
  reactPair: string[];     // {spec} {spec2}
  reactTheme: string[];    // {theme}
  reactGeneric: string[];
  warm: string[];          // optional extra human beat (pos/mixed)
  brand: string[];         // mid-body {store} mention (SEO entity signal)
  kwWoven: string[];       // quoted {kw} forced-GEO-keyword weave (AIO signal)
  geoWoven: string[];      // {geo} locality (pos/mixed)
  body: string[];          // invite-back (pos/mixed) | make-it-right (neg)
  close: string[];
  signoff: string[];       // {store}
};
export type LocalePools = Record<Sentiment, ReplyPool>;

// ═══════════════════════════════════════════════════════════════════ EN ════
const EN: LocalePools = {
  positive: {
    open: [
      "Thanks for the kind words, honestly made our day.",
      "Reviews like this are the best part of the job.",
      "Well, this just made our week.",
      "Really glad you had a good time, and thanks for saying so.",
      "You didn't have to leave this, and we're so glad you did.",
      "This put a big smile on the whole team.",
      "Made our day reading this, thank you.",
      "So happy you enjoyed it, and thank you for taking the time to say so.",
      "Thank you for the lovely review.",
      "What a great thing to wake up to, thank you.",
      "Cheers for taking a minute to write this, it means more than you'd think.",
      "We really appreciate you sharing this.",
      "This is the kind of review we screenshot and send to the group chat.",
      "Reading this out loud to the team was a good moment, thank you.",
      "Honestly, this is why we open the doors every morning.",
      "Thank you! Reviews like yours keep a small business going.",
      "We were smiling the whole way through this one.",
      "Now this is how you start a shift. Thank you!",
      "Thank you so much, this genuinely means a lot to all of us.",
      "So glad it was a good one, and thanks for letting us know.",
      "We don't take a review like this for granted, thank you.",
      "That's wonderful to hear, thank you for writing it up.",
      "A review like this travels around the whole team by lunchtime. Thank you!",
      "Big thanks from all of us here, this was lovely to read.",
      "You've just made a few people's day over here.",
      "Thank you, truly. It's feedback like this that tells us we're on the right track.",
      "We appreciate you! Thanks for spending part of your day writing this.",
      "This one's going on the wall. Thank you!",
    ],
    openNoText: [
      "Five stars with no notes, we'll take that any day. Thank you.",
      "Thanks for the rating, it went straight to the team.",
      "You took a second to rate us, and that second counts. Thank you.",
      "Quiet five stars are still five stars, and we appreciate every one.",
      "Thank you for the stars.",
      "No words needed, the rating says plenty. Thanks for leaving it.",
      "Appreciate you stopping to rate us.",
      "Thanks for the score, it means more to a small place than you'd guess.",
      "A rating from you is a good start to the day, so thank you.",
      "Thank you for taking a moment to rate us.",
      "Short and sweet, and very welcome. Thank you.",
      "That rating landed well over here, thanks for it.",
    ],
    reactNoText: [
      "We won't pretend to know which part won you over, but we're glad something did.",
      "Whatever it was that worked for you, we're happy it did.",
      "You didn't say what landed, and that's fine, the score tells us enough.",
      "We'd love to know what stood out, though we're glad it went well either way.",
      "A rating like that tells us we got the important parts right.",
      "Sounds like we did our job, which is all we ask for.",
      "We'll take it as a sign we're pointed the right way.",
      "If you ever feel like telling us what stood out, we're all ears.",
      "No detail needed, we're just glad the visit was worth the stars.",
      "That's a good sign we're doing something right.",
    ],
    bodyNoText: [],
    reactSpec: [
      "So glad the {spec} hit the spot for you.",
      "Really pleased the {spec} landed the way it did.",
      "Great to hear the {spec} was a highlight.",
      "Nothing makes us happier than hearing the {spec} was spot on.",
      "We're proud of the {spec}, so thank you for calling it out.",
      "Lovely to hear the {spec} did the trick.",
      "The {spec} is something we care a lot about, so this means a lot.",
      "Chuffed the {spec} lived up to it.",
      "Happy the {spec} was as good as we hoped.",
      "Good to know the {spec} stood out for you.",
      "The {spec} gets a lot of quiet work behind the scenes, so it's lovely when someone notices.",
      "We fuss over the {spec} more than we'd like to admit, so this was great to read.",
      "Hearing the {spec} was a hit makes the early mornings worth it.",
      "The {spec} is a bit of a point of pride around here, glad it showed.",
      "You picked our favourite thing to hear about: the {spec}.",
      "That's exactly what we're going for with the {spec}.",
      "The {spec} being mentioned by name is the best compliment we get.",
      "We put real care into the {spec}, and it's lovely that it came through.",
      "Glad the {spec} earned its spot on the menu of your day.",
      "The team behind the {spec} will be very pleased with this one.",
      "There's a lot of trial and error behind the {spec}, so thank you for noticing.",
      "It's always the {spec} we hope people mention, and here you are.",
    ],
    reactPair: [
      "So glad the {spec} and the {spec2} both landed for you.",
      "Great to hear the {spec} and the {spec2} hit the mark.",
      "Nothing better than hearing the {spec} and the {spec2} both stood out.",
      "Really pleased both the {spec} and the {spec2} did the job.",
      "The {spec} and the {spec2} are things we work hard on, so thank you for noticing both.",
      "The {spec} AND the {spec2}? You've named our two favourite subjects.",
      "Getting the {spec} and the {spec2} right on the same visit is exactly the plan, glad it worked.",
      "We put a lot into both the {spec} and the {spec2}, so this one goes straight to the team.",
      "Hearing the {spec} and the {spec2} both got a mention made our morning.",
      "The {spec} and the {spec2} together, that's the combination we hope every guest gets.",
      "Both the {spec} and the {spec2} being called out in one review is as good as it gets for us.",
      "So pleased the {spec} was on point, and the {spec2} too.",
      "That's the double we aim for: the {spec} and the {spec2}.",
      "The {spec} and the {spec2} each have someone here who'll be thrilled to read this.",
    ],
    reactTheme: [
      "Really glad {theme} made an impression.",
      "Great to hear {theme} stood out.",
      "We put a lot into {theme}, so this means a lot.",
      "So pleased {theme} made the visit for you.",
      "Nothing we like more than hearing {theme} landed well.",
      "{theme} is something we quietly obsess over, so thank you for noticing.",
      "Hearing good things about {theme} never gets old.",
      "We've been working hard on {theme} lately, so this is well timed.",
      "It means a lot that {theme} came through the way we intend it to.",
      "That's exactly the impression we hope {theme} leaves.",
    ],
    reactGeneric: [
      "Really glad the whole visit landed well.",
      "Great to hear you had such a good time.",
      "Sounds like it all came together, which is exactly what we go for.",
      "Nothing better than hearing a visit went this well.",
      "When the whole visit clicks like that, it's a good day on both sides of the counter.",
      "We aim for exactly the kind of visit you've described, so this is lovely to read.",
      "A start-to-finish good visit is the goal every single day, glad yours was one.",
      "It sounds like you caught us doing what we love doing, and that's great to hear.",
      "Everything coming together like that is what we practise for.",
      "That's the full experience we hope everyone walks away with.",
    ],
    warm: [
      "It's guests like you that make the long days worth it.",
      "We'll be sure to pass this on to the team.",
      "Little notes like this keep us going.",
      "You've set the bar for the next visit now.",
      "The whole crew will hear about this one at the morning huddle.",
      "Reviews this generous are rare, and we don't take them lightly.",
      "Word of mouth from people like you is how a small place like ours grows.",
      "This is going straight to the person who made it, they'll be over the moon.",
      "Days get long here, and a note like this shortens them.",
      "You might have just made someone's whole week in our kitchen.",
      "We remember guests like you, in the best way.",
      "Support like this from regular guests means everything to an independent business.",
      "Genuinely, thank you for taking the time. Most people don't, and we notice the ones who do.",
      "There's a team of real people behind this place, and every one of them will appreciate this.",
      "We read every single review together, and this one got a cheer.",
      "It's reviews like yours that new guests read before they decide to visit, so thank you twice.",
    ],
    brand: [
      "That's exactly the experience we want {store} to be known for.",
      "It's what we set out to build with {store}, so it's lovely to see it land.",
      "This is precisely what {store} is supposed to feel like.",
      "We want every visit to {store} to read just like this.",
      "You've described the {store} we try to be every single day.",
      "That's the standard we hold {store} to, and we're glad it showed.",
      "Everything we do at {store} is aimed at visits like yours.",
      "This is the version of {store} we work hardest to deliver.",
      "Hearing {store} described like this is the whole point of the work.",
      "We built {store} hoping people would feel exactly what you've written.",
      "That's {store} at its best, and we're glad you caught it.",
      "Reviews like this tell us {store} is doing what it was made to do.",
    ],
    kwWoven: [
      "\"{kw}\" is what we aim for every single day, so this review really lands.",
      "We hang our hat on \"{kw}\", and it's wonderful when a guest feels it too.",
      "People come to us for \"{kw}\", and we never want to let that down.",
      "\"{kw}\" is the promise we make, and your review says we kept it.",
      "If there's one thing we want to be known for, it's \"{kw}\", so thank you.",
      "We've built our reputation on \"{kw}\", and reviews like yours protect it.",
      "\"{kw}\" isn't just a line for us, and it means a lot that it showed.",
      "Everything here starts with \"{kw}\", glad that came through.",
      "We take \"{kw}\" seriously around here, so this was great to read.",
      "Your review is exactly why we keep pushing on \"{kw}\".",
      "That's \"{kw}\" doing its job, and we're delighted you noticed.",
      "\"{kw}\" is the bar we set ourselves, and we're glad your visit cleared it.",
    ],
    geoWoven: [
      "We're proud to be part of {geo}, and glad you found us.",
      "Folks like you make being in {geo} worth it.",
      "If you're ever back around {geo}, you know where we are.",
      "Glad to have you as a neighbour here in {geo}.",
      "Reviews like this are why we love being in {geo}.",
      "There's no better feeling than being a local favourite in {geo}.",
      "Serving {geo} is a privilege, and guests like you are the reason.",
      "We opened in {geo} hoping for moments exactly like this one.",
      "Being part of the {geo} neighbourhood means everything to us.",
      "Next time you're in {geo}, drop by and say hello.",
      "It's guests from around {geo} who've made this place what it is.",
      "We love this corner of {geo}, and it's even better with guests like you.",
      "Anyone wandering {geo} looking for us, this review says it better than we could.",
      "The {geo} community has been so good to us, and you've just added to that.",
      "We're a {geo} local through and through, and proud of it.",
      "Whenever you're back in {geo}, your spot's waiting.",
      "It's a joy doing what we do here in {geo}.",
      "{geo} has plenty of choices, so you choosing us means a lot.",
    ],
    body: [
      "Come see us again soon.",
      "We'd love to have you back.",
      "We'll aim to make the next one even better.",
      "Already looking forward to your next visit.",
      "Don't be a stranger.",
      "Hope to see you again before long.",
      "Next time you're in, say hi at the counter.",
      "We'll keep your kind of visit in mind and try to top it next time.",
      "There's always something new to try, so come back hungry.",
      "The door's open whenever you're nearby.",
      "Bring a friend next time, we'd love to meet them.",
      "We'll be here doing our thing whenever you're ready for round two.",
      "Consider yourself part of the family now.",
      "Your next visit already has a lot to live up to, and we're up for it.",
    ],
    close: [
      "Thanks again!",
      "See you soon.",
      "Take care.",
      "All the best.",
      "Cheers.",
      "Until next time!",
      "With our thanks.",
      "Have a great week.",
      "Thanks a million.",
      "Warmest thanks from all of us.",
    ],
    signoff: [
      "The team at {store}",
      "{store} team",
      "Warmly, {store}",
      "{store}",
      "With thanks, {store}",
      "Everyone at {store}",
      "Your friends at {store}",
      "All of us at {store}",
    ],
  },
  mixed: {
    open: [
      "Thanks for the honest write-up, we take it on board.",
      "Appreciate you being straight with us.",
      "Thanks for the balanced review, genuinely useful.",
      "Good to hear what worked and what didn't.",
      "We really value feedback like this.",
      "Thanks for taking the time to lay it all out.",
      "Honest reviews like this are worth more to us than perfect scores.",
      "We'd rather have this kind of candour than silence, thank you.",
      "Thank you for the fair shake, we'll use every word of it.",
      "This is exactly the kind of feedback that makes us better.",
      "Appreciate the detail here, it gives us something concrete to work with.",
      "A balanced review takes more effort to write, and we appreciate it.",
    ],
    openNoText: [
      "Thanks for the rating. It's honest, and we'd rather have honest.",
      "We noticed the rating, and we're taking it seriously.",
      "Appreciate you rating us, even if it wasn't a glowing one.",
      "Thank you for the rating. A middling score is still worth knowing about.",
      "We saw the stars, and we'd like to understand them.",
      "Thanks for rating us honestly rather than not at all.",
      "A three-star day is a day we can do better, so thank you for saying so.",
      "We'd rather see this than nothing at all, so thanks for leaving it.",
    ],
    reactNoText: [
      "Without any detail we're guessing, and we'd rather not guess.",
      "You didn't write anything, so we're left wondering which part missed.",
      "Something clearly fell short of good, we just don't know what yet.",
      "A score like that usually means one thing went wrong on an otherwise fine visit.",
      "We can't fix what we can't see, and right now we can't see it.",
      "There's a gap between that rating and what we aim for, and we'd like to close it.",
      "We'd genuinely like to know what kept it from being a better visit.",
      "Somewhere in there we missed, and it'd help to know where.",
    ],
    bodyNoText: [
      "If you have a minute, tell us what would have made it better.",
      "We'd welcome a line about what let it down, even a short one.",
      "Drop us a note about what missed and we'll do something about it.",
      "If you're up for it, let us know what we could have done differently.",
      "Even one sentence about what went wrong would help us fix it.",
      "We'd rather hear the specifics than guess, so please get in touch if you can.",
    ],
    reactSpec: [
      "Point taken on the {spec}, we'll sort it.",
      "We hear you on the {spec}, and we'll tighten it up.",
      "Fair shout on the {spec}, that's on us to fix.",
      "Thanks for flagging the {spec}, we're already on it.",
      "The {spec} is fixable, and we intend to fix it.",
      "You're not the first to mention the {spec}, and we're taking it seriously now.",
      "The {spec} clearly needs another look, and it'll get one.",
      "We've talked about the {spec} as a team since reading this.",
    ],
    reactPair: [
      "Really glad the {spec} worked for you, and we're sorry the {spec2} fell short.",
      "Great that the {spec} landed, and point taken on the {spec2}.",
      "Glad the {spec} hit the mark, though we'll fix the {spec2}.",
      "Happy the {spec} was a highlight, and we hear you on the {spec2}.",
      "The {spec} we're proud of; the {spec2} we're working on, starting now.",
      "Thanks for the kind words on the {spec}, and the honest ones on the {spec2}.",
      "The {spec} being good makes the {spec2} falling short sting more, and we'll fix it.",
      "So pleased about the {spec}. The {spec2}, though, that's homework for us.",
      "We'll take the win on the {spec} and the lesson on the {spec2}.",
      "You're right on both counts: the {spec} deserved the praise, the {spec2} deserved the note.",
    ],
    reactTheme: [
      "Glad parts of it worked, and we hear you on {theme}.",
      "Good to know {theme} left an impression, mixed as it was.",
      "We're looking at {theme} with fresh eyes because of notes like this.",
    ],
    reactGeneric: [
      "Glad some of it landed, and we hear you on the rest.",
      "We'll take the good and fix what missed.",
      "Point taken, and we'll do better on the rest.",
      "Helpful to know what worked and what we can sharpen.",
      "The good parts we'll keep, the rest we'll get right.",
      "There's clearly a gap between our best and what you got, and we'll close it.",
    ],
    warm: [
      "We'd genuinely rather hear this than not.",
      "This is the kind of note that actually changes things here.",
      "Feedback like yours is how a place improves instead of coasting.",
      "We talk about reviews like this in our team meetings, in a good way.",
      "It takes a fair-minded guest to write a review like this one.",
      "You've given us something specific to fix, which is a gift, honestly.",
    ],
    brand: [
      "We want {store} to be better than the visit you had, and it will be.",
      "That's not the {store} standard, and we know it.",
      "The {store} you described is close to what we want, but not all the way there yet.",
      "We hold {store} to a higher bar than this, and we'll prove it.",
      "Next time, we want you to see {store} at its best.",
      "{store} gets better because of reviews like this one.",
    ],
    kwWoven: [
      "\"{kw}\" is the standard we set ourselves, and this visit didn't fully live up to it.",
      "We promise \"{kw}\", and we'll make sure the next visit actually delivers it.",
      "You should have had \"{kw}\" through and through, and we'll close that gap.",
      "\"{kw}\" is what we're known for, so we take a visit like yours seriously.",
    ],
    geoWoven: [
      "We want to be the spot you count on in {geo}, and we'll keep at it.",
      "Getting it right for our {geo} regulars matters to us.",
      "We're here for the long run in {geo}, and we'll earn the next visit.",
      "The {geo} neighbourhood deserves our best, and we'll bring it.",
      "We didn't set up in {geo} to be average, and we won't settle for it.",
    ],
    body: [
      "We'd love another shot at it.",
      "Give us another go, we think you'll notice the difference.",
      "We'll put this right next time.",
      "Hope you'll let us make it up to you.",
      "Come back once more, on your schedule, and see if we've moved the needle.",
      "The next visit is ours to earn, and we plan to.",
      "If you give us one more chance, we'll aim to make this review feel out of date.",
    ],
    close: [
      "Thanks again.",
      "Hope to see you back.",
      "We appreciate you.",
      "Thanks for keeping us honest.",
      "Grateful for the push.",
    ],
    signoff: [
      "The team at {store}",
      "{store} team",
      "{store}",
      "With thanks, {store}",
    ],
  },
  negative: {
    open: [
      "Really sorry this one missed the mark.",
      "Sorry to hear this, and thanks for telling us.",
      "This isn't how we want anyone to leave, our apologies.",
      "We dropped the ball here, and we're sorry.",
      "Sorry, this genuinely isn't like us.",
      "This one's on us, and we're sorry.",
      "We owe you an apology, plain and simple.",
      "Reading this stung, because it should never have happened.",
      "First off: we're sorry. No excuses.",
      "That's not the visit you deserved, and we apologize.",
    ],
    openNoText: [
      "A rating like that means we let you down somewhere, and we're sorry.",
      "We're sorry. That score tells us the visit went badly.",
      "Sorry to see this. Nobody leaves a rating like that for no reason.",
      "That's a hard rating to read, and we'd rather understand it than ignore it.",
      "We saw the rating, and we're sorry the visit earned it.",
      "First off, our apologies. That score says we got something badly wrong.",
      "Sorry. A rating like this one means we missed by a long way.",
      "We won't argue with the rating, we'd just like to know what caused it.",
    ],
    reactNoText: [
      "You didn't say what happened, and we'd really like to know.",
      "We're in the dark on the details, which makes it hard to fix.",
      "Whatever went wrong, we'd rather hear it than guess at it.",
      "We can't put right what we don't understand yet.",
      "Something clearly went wrong on our side, and we want the specifics.",
      "We'd rather know exactly where we failed than assume.",
      "No detail means no fix, and we do want to fix this.",
      "We'd like to hear what happened, straight from you.",
    ],
    bodyNoText: [
      "Please tell us what went wrong, we'll look into it properly.",
      "If you'll share what happened, we'll make it right.",
      "Get in touch and tell us what we did, we'd like the chance to fix it.",
      "We'd appreciate a line about what went wrong so we can deal with it.",
      "Reach out and let us know what happened, we take this seriously.",
      "Tell us what we got wrong and we'll do something about it, not just apologise.",
    ],
    reactSpec: [
      "You're right about the {spec}, and it's not good enough.",
      "We're sorry the {spec} let you down.",
      "The {spec} should have been better, and that's on us.",
      "We hate that the {spec} missed the mark for you.",
      "There's no excuse for the {spec}, and we're looking into it.",
      "The {spec} has been raised with the team directly.",
      "We've gone back over what happened with the {spec}, and it won't be brushed aside.",
    ],
    reactPair: [
      "We're sorry about both the {spec} and the {spec2}, neither is our standard.",
      "The {spec} and the {spec2} both fell short, and that's on us.",
      "Two misses in one visit, the {spec} and the {spec2}, is two too many.",
      "You shouldn't have had to write about the {spec} or the {spec2}, let alone both.",
    ],
    reactTheme: [
      "You're right about {theme}, and it's not where it should be.",
      "{theme} isn't our standard, and we own that.",
      "We're taking a hard look at {theme} after reading this.",
    ],
    reactGeneric: [
      "This isn't the standard we hold ourselves to, and we own it.",
      "That's not the experience we intend, and we take responsibility.",
      "We're looking into exactly what went wrong.",
      "This falls short of what we expect of ourselves.",
      "Whatever went wrong on our side, it's ours to face and fix.",
    ],
    warm: [],
    brand: [],
    kwWoven: [],
    geoWoven: [],
    body: [
      "We'd like to put this right, so please get in touch with us directly.",
      "Reach out to us directly and we'll do our best to fix it.",
      "Please contact us directly so we can make it right.",
      "We'd welcome the chance to fix this, please get in touch.",
      "If you're willing, contact us directly, we'd like to make this up to you properly.",
      "Please give us a chance to fix this one on one, reach out any time.",
    ],
    close: [
      "Thanks for giving us the chance to do better.",
      "We're grateful for the honesty, and we'll improve.",
      "We hope you'll let us make it up to you.",
      "Thank you for holding us to a higher standard.",
    ],
    signoff: [
      "The team at {store}",
      "The management at {store}",
      "{store}",
    ],
  },
};

// ═══════════════════════════════════════════════════════════════════ JA ════
const JA: LocalePools = {
  positive: {
    open: [
      "嬉しいお言葉、本当にありがとうございます。",
      "こういうレビューをいただけるのが、この仕事の一番の励みです。",
      "読んでいて思わず笑顔になりました。",
      "楽しんでいただけたようで、こちらまで嬉しくなりました。",
      "わざわざ書いてくださって、スタッフ一同大喜びです。",
      "ご来店とお褒めのお言葉、心より感謝です。",
      "朝からとても嬉しいご感想をありがとうございます。",
      "お褒めいただき光栄です。",
      "温かいレビューをありがとうございます。朝礼で全員に共有しました。",
      "こんなに嬉しいご感想は久しぶりです。ありがとうございます。",
      "お忙しい中レビューを書いてくださって、本当にありがとうございます。",
      "スタッフみんなで回し読みしました。ありがとうございます。",
      "ご来店いただけただけでも嬉しいのに、こんなお言葉まで。感謝です。",
      "一日の疲れが吹き飛ぶレビューでした。ありがとうございます。",
      "この仕事をやっていて良かったと思える瞬間です。ありがとうございます。",
      "何度も読み返してしまいました。本当にありがとうございます。",
    ],
    openNoText: [
      "高い評価をつけてくださって、ありがとうございます。",
      "星をつけていただけただけで、十分嬉しいです。ありがとうございます。",
      "評価をいただき、ありがとうございます。スタッフにもすぐ伝えました。",
      "ひと手間かけて評価してくださったこと、感謝しています。",
      "満点の評価、ありがたく受け取りました。",
      "コメントがなくても、この評価だけで伝わるものがあります。ありがとうございます。",
      "お忙しい中、評価だけでも残していただけて嬉しいです。",
      "評価をつけていただき、ありがとうございます。励みになります。",
      "その星の数が、何よりの励みです。ありがとうございます。",
      "ご来店と評価、どちらも本当にありがとうございます。",
    ],
    reactNoText: [
      "どの部分が良かったのかは分かりませんが、ご満足いただけたようで安心しました。",
      "何がお気に召したのか、いつか教えていただけたら嬉しいです。",
      "詳しいことは分かりませんが、良い時間を過ごしていただけたのだと受け止めています。",
      "この評価をいただけたということは、大事なところは外していなかったのだと思います。",
      "何かひとつでも良いと感じていただけたのなら、それだけで十分です。",
      "私たちのやっていることが間違っていないと、背中を押された気持ちです。",
      "気に入っていただけた点があれば、次回ぜひ聞かせてください。",
      "細かいことは抜きにして、良い一日になっていたなら嬉しいです。",
    ],
    bodyNoText: [],
    reactSpec: [
      "{spec}を気に入っていただけて、本当に嬉しいです。",
      "{spec}が印象に残ったとのこと、何よりの励みになります。",
      "{spec}にはこだわっているので、そう言っていただけると報われます。",
      "{spec}をお褒めいただき、ありがとうございます。",
      "{spec}をそう感じていただけたなら、頑張った甲斐があります。",
      "{spec}は特に力を入れているところなので、気づいていただけて嬉しいです。",
      "{spec}を名指しで褒めていただけるのが、実は一番嬉しいんです。",
      "{spec}には日々試行錯誤を重ねているので、格別に嬉しいお言葉です。",
      "{spec}のこと、担当した者に必ず伝えます。きっと飛び上がって喜びます。",
      "{spec}がお口に合ったようで、ほっとしました。",
      "{spec}は当店の看板だと思っているので、光栄です。",
      "{spec}へのお褒め、明日への大きな活力になります。",
    ],
    reactPair: [
      "{spec}も{spec2}も気に入っていただけて、本当に嬉しいです。",
      "{spec}と{spec2}、どちらもお褒めいただき光栄です。",
      "{spec}に加えて{spec2}まで喜んでいただけて、励みになります。",
      "{spec}と{spec2}の両方に触れていただけるのは、最高の褒め言葉です。",
      "{spec}も{spec2}も、それぞれ担当の者が喜びます。ありがとうございます。",
      "{spec}と{spec2}を同時に楽しんでいただくのが理想の形なので、嬉しい限りです。",
      "{spec}も{spec2}も日々磨いているところなので、伝わって嬉しいです。",
      "まさに{spec}と{spec2}こそ、私たちが自信を持っているところです。",
    ],
    reactTheme: [
      "{theme}にご満足いただけたようで、大変嬉しいです。",
      "{theme}が印象に残ったとのこと、何よりです。",
      "{theme}にはこだわっているので、そう言っていただけると報われます。",
      "{theme}を褒めていただけるのが、実は一番嬉しいんです。",
      "{theme}は日々改善を重ねているところなので、励みになります。",
    ],
    reactGeneric: [
      "全体を楽しんでいただけたようで、本当に嬉しいです。",
      "良いひとときをお過ごしいただけて何よりです。",
      "こういうご感想が、日々の一番の励みです。",
      "最初から最後までご満足いただけたなら、これ以上のことはありません。",
      "まさに私たちが目指している過ごし方をしていただけたようで、嬉しいです。",
    ],
    warm: [
      "いただいたお言葉、スタッフにも共有いたします。",
      "明日からの活力をいただきました。",
      "小さなお店にとって、こうしたお声は何よりの支えです。",
      "お客様の一言で、現場の空気が明るくなるんです。",
      "こういうレビューを読んで、新しいお客様が来てくださいます。二重にありがたいです。",
      "常連の皆様に支えられているお店だと、改めて実感しました。",
    ],
    brand: [
      "まさに{store}が目指している姿を言葉にしていただけました。",
      "{store}はこういうお店でありたいと、いつも話しています。",
      "これこそ{store}の理想の形です。伝わって嬉しいです。",
      "{store}を作ってきて良かったと思える瞬間です。",
      "毎日その水準を{store}の当たり前にできるよう、精進します。",
      "{store}らしさを感じていただけたなら本望です。",
    ],
    kwWoven: [
      "「{kw}」を掲げている私たちにとって、何より嬉しいお言葉です。",
      "「{kw}」は当店のお約束なので、感じていただけて光栄です。",
      "「{kw}」にこだわり続けてきた甲斐がありました。",
      "私たちの看板は「{kw}」です。その通りだと言っていただけた気がして嬉しいです。",
      "「{kw}」を目指す毎日に、大きなご褒美をいただきました。",
      "「{kw}」という言葉に恥じないよう、これからも磨いていきます。",
    ],
    geoWoven: [
      "{geo}でお店を続けてこられるのも、こうしたお声のおかげです。",
      "{geo}にお越しの際は、ぜひまた覗いてください。",
      "{geo}で愛されるお店を目指して、これからも頑張ります。",
      "{geo}という土地でやってきて良かったと思える瞬間です。",
      "{geo}の皆さんに支えられているお店です。ありがとうございます。",
      "{geo}にはお店がたくさんある中で選んでいただけて、光栄です。",
      "{geo}の一角で、これからも変わらず営業しています。",
      "{geo}散策の際は、いつでもお立ち寄りください。",
    ],
    body: [
      "またお待ちしております。",
      "ぜひまた遊びに来てください。",
      "次はさらに良い時間にできるよう頑張ります。",
      "またお会いできるのを楽しみにしています。",
      "季節ごとに新しいものもご用意していますので、ぜひまた。",
      "次回はぜひ、他のおすすめも試してみてください。",
      "お近くにいらした際は、お気軽にどうぞ。",
      "今度はご友人ともぜひ。お待ちしています。",
    ],
    close: [
      "改めて、ありがとうございました。",
      "またお会いしましょう。",
      "どうぞお気をつけて。",
      "素敵な一週間をお過ごしください。",
      "重ねて、御礼申し上げます。",
    ],
    signoff: [
      "{store} スタッフ一同",
      "{store} 一同",
      "{store}",
      "{store} 店主",
    ],
  },
  mixed: {
    open: [
      "正直なご感想、ありがとうございます。しっかり受け止めます。",
      "率直に教えていただけて助かります。",
      "良い点も気になる点も書いてくださって感謝です。",
      "こうしたお声が一番の改善のヒントになります。",
      "バランスの取れたご意見、ありがたく拝読しました。",
      "褒めるだけでなく課題も伝えてくださる方は貴重です。ありがとうございます。",
    ],
    openNoText: [
      "評価をつけてくださり、ありがとうございます。正直な数字として受け止めます。",
      "評価を拝見しました。真摯に受け止めています。",
      "満点ではない評価も、いただけるだけありがたいです。",
      "評価をありがとうございます。この点数の理由を知りたいと思っています。",
      "何も書かずとも、評価を残してくださったことに感謝します。",
      "正直な評価をいただけたことを、ありがたく思っています。",
    ],
    reactNoText: [
      "コメントがない分、どこが物足りなかったのかを推測するしかない状況です。",
      "何かが期待に届かなかったのだと思いますが、その中身がまだ分かりません。",
      "見えていない課題があるはずで、それを知りたいと思っています。",
      "この評価と私たちの目指すところには差があります。その差を埋めたいです。",
      "どこでご期待に添えなかったのか、正直なところ掴めていません。",
      "推測で直すのではなく、実際のところを教えていただきたいです。",
    ],
    bodyNoText: [
      "もしお時間があれば、どこが惜しかったのか一言でも教えていただけませんか。",
      "気になった点を教えていただけると、必ず改善に活かします。",
      "一行で構いませんので、足りなかった点をお聞かせいただけると助かります。",
      "次はもっと良い時間にできるよう、ご意見をお待ちしています。",
      "推測で終わらせたくないので、よろしければご連絡ください。",
    ],
    reactSpec: [
      "{spec}のご指摘、しっかり改善します。",
      "{spec}についてはおっしゃる通りで、見直します。",
      "{spec}のお声、社内で共有いたします。",
      "{spec}は早速チームで話し合いました。必ず良くします。",
    ],
    reactPair: [
      "{spec}を気に入っていただけた一方、{spec2}は至らず申し訳ありません。改善します。",
      "{spec}はお褒めいただき嬉しく、{spec2}のご指摘は真摯に受け止めます。",
      "{spec}が良かったとのこと嬉しく思う反面、{spec2}は必ず直します。",
      "{spec}は自信があるところ、{spec2}は課題です。次回までに整えます。",
      "{spec}の評価は励みに、{spec2}のご指摘は宿題にさせていただきます。",
    ],
    reactTheme: [
      "良かった点を嬉しく思う一方、{theme}のご指摘は真摯に受け止めます。",
      "{theme}については見直してまいります。",
    ],
    reactGeneric: [
      "楽しんでいただけた点は嬉しく、至らぬ点は真摯に受け止めます。",
      "良い点は伸ばし、足りない点は必ず直します。",
      "いただいたお声を大切に改善します。",
      "本来の力とのギャップを埋めるのは、私たちの仕事です。",
    ],
    warm: [
      "こうしたお声こそ、私どもが変わるきっかけになります。",
      "具体的に教えていただけたことが、何よりありがたいです。",
    ],
    brand: [
      "{store}はこの程度で満足するお店ではありません。次で証明します。",
      "本来の{store}を、次回こそお見せしたいです。",
      "{store}の名に恥じないよう、いただいた課題に向き合います。",
    ],
    kwWoven: [
      "「{kw}」を掲げている以上、今回のご指摘は重く受け止めます。",
      "「{kw}」というお約束を、隅々まで行き届かせます。",
    ],
    geoWoven: [
      "{geo}で信頼いただけるお店になれるよう、いただいたお声を活かします。",
      "{geo}の皆さんに安心して通っていただけるよう努めます。",
      "{geo}で長く続けたいからこそ、こうしたご指摘が財産です。",
    ],
    body: [
      "ぜひもう一度お試しいただけると嬉しいです。",
      "次回は違いを感じていただけるよう頑張ります。",
      "挽回の機会をいただけますと幸いです。",
      "次のご来店で「変わった」と思っていただけるよう準備します。",
    ],
    close: [
      "また機会をいただけたら嬉しいです。",
      "ありがとうございました。",
      "またのお越しをお待ちしています。",
      "貴重なお時間をありがとうございました。",
    ],
    signoff: [
      "{store} スタッフ一同",
      "{store} 一同",
      "{store}",
    ],
  },
  negative: {
    open: [
      "この度は残念な思いをさせてしまい、申し訳ありませんでした。",
      "ご不快な思いをおかけし、心よりお詫びします。",
      "教えてくださってありがとうございます。そして、申し訳ありませんでした。",
      "本来の私どもらしくない対応で、深くお詫びします。",
      "まずお詫びさせてください。言い訳はいたしません。",
      "拝読して、あってはならないことだと痛感しました。申し訳ございません。",
    ],
    openNoText: [
      "この評価をいただくということは、どこかで至らなかったということです。申し訳ありません。",
      "評価を拝見しました。ご期待に応えられず、申し訳ありませんでした。",
      "厳しい評価、真摯に受け止めます。申し訳ございませんでした。",
      "理由のない低評価はないと思っています。まずはお詫び申し上げます。",
      "まずお詫びさせてください。この評価は、私どもの落ち度だと受け止めています。",
      "評価そのものに異論はありません。ただ、何があったのかを知りたいのです。",
    ],
    reactNoText: [
      "何があったのかが分からないままで、それが一番心苦しいところです。",
      "詳細が見えないままでは、同じことを繰り返してしまいます。",
      "推測でお詫びするのではなく、実際に起きたことを知りたいです。",
      "どこで失礼があったのか、正直に教えていただきたいと思っています。",
      "分からないままにしておきたくない、というのが本音です。",
      "私どものどこに問題があったのか、はっきり伺えればと思います。",
    ],
    bodyNoText: [
      "何があったのか、ぜひお聞かせください。必ず確認いたします。",
      "差し支えなければご連絡ください。きちんと対応させていただきます。",
      "お手数ですが、状況を教えていただけないでしょうか。責任を持って改善します。",
      "一言でも構いませんので、何が起きたのかお知らせいただけると助かります。",
      "お詫びだけで終わらせたくありません。ぜひご連絡ください。",
    ],
    reactSpec: [
      "{spec}については、おっしゃる通り私どもの至らぬ点です。",
      "{spec}でご不便をおかけし、申し訳ありません。",
      "{spec}は本来の水準ではなく、責任を持って改善します。",
      "{spec}の件は、その日のうちにチームで確認し対策を始めています。",
    ],
    reactPair: [
      "{spec}も{spec2}も本来あるべき姿ではなく、深くお詫びします。",
      "{spec}に加えて{spec2}まで。二重にご迷惑をおかけしました。",
    ],
    reactTheme: [
      "{theme}についてはおっしゃる通りで、本来あるべき水準ではありません。",
      "{theme}は私どもの反省点であり、必ず改善します。",
    ],
    reactGeneric: [
      "本来あるべき水準に達しておらず、私どもの責任です。",
      "ご指摘は反省すべき点であり、真摯に受け止めます。",
      "何が至らなかったのか、しっかり見直します。",
      "どこで歯車が狂ったのか、原因を確認しています。",
    ],
    warm: [],
    brand: [],
    kwWoven: [],
    geoWoven: [],
    body: [
      "改善のため、差し支えなければ直接ご連絡いただけますと幸いです。",
      "きちんと対応したく、ぜひ一度ご連絡ください。",
      "この件を適切に解決したく、直接のご連絡をお待ちしています。",
      "お詫びも兼ねて直接お話しできれば幸いです。ご連絡お待ちしております。",
    ],
    close: [
      "貴重なお声、ありがとうございました。",
      "必ず改善します。",
      "挽回の機会をいただけますと幸いです。",
      "高い基準を求めてくださることに、感謝いたします。",
    ],
    signoff: [
      "{store} スタッフ一同",
      "{store} 一同",
      "{store} 店主",
    ],
  },
};

// ═══════════════════════════════════════════════════════════════════ AR ════
const AR: LocalePools = {
  positive: {
    open: [
      "شكرًا على كلماتك الطيبة، أسعدت يومنا فعلًا.",
      "مثل هذه التقييمات هي أجمل ما في عملنا.",
      "سعدنا كثيرًا بقراءة هذا.",
      "يسعدنا أنك قضيت وقتًا جميلًا، وشكرًا لقولك ذلك.",
      "لم يكن عليك كتابة هذا، ونحن ممتنّون أنك فعلت.",
      "شكرًا لتخصيص وقتك لكتابة هذا.",
      "قرأنا تقييمك للفريق كله، وأسعد الجميع.",
      "هذا النوع من التقييمات يجعل الأيام الطويلة تستحق العناء.",
    ],
    openNoText: [
      "شكرًا على التقييم، وصل إلى الفريق مباشرة.",
      "خمس نجوم دون كلمات تكفينا تمامًا. شكرًا لك.",
      "شكرًا لتخصيص لحظة لتقييمنا.",
      "نقدّر لك هذا التقييم، ويعني الكثير لمكان صغير مثلنا.",
      "شكرًا على النجوم.",
      "لا حاجة للكلمات، التقييم يقول ما يكفي. شكرًا لك.",
    ],
    reactNoText: [
      "لا نعرف أي جزء أعجبك تحديدًا، لكننا سعداء أن شيئًا ما نال إعجابك.",
      "مهما كان سبب رضاك، يسعدنا أنه كان كذلك.",
      "تقييم كهذا يعني أننا أصبنا في الأمور المهمة.",
      "يسرّنا أن نعرف ما الذي أعجبك، وإن كنا سعداء بالنتيجة على أي حال.",
      "نعتبره إشارة إلى أننا نسير في الاتجاه الصحيح.",
      "يبدو أننا قمنا بعملنا، وهذا كل ما نطمح إليه.",
    ],
    bodyNoText: [],
    reactSpec: [
      "يسعدنا حقًا أن {spec} نال إعجابك.",
      "جميل أن نعرف أن {spec} كان مميزًا لك.",
      "نبذل جهدًا كبيرًا في {spec}، لذا يعني لنا هذا الكثير.",
      "سعداء أن {spec} كان كما تمنيت.",
      "{spec} من الأشياء التي نعتني بها كثيرًا، وسعدنا أنك لاحظت.",
      "سنخبر المسؤول عن {spec} بكلماتك، وسيسعد كثيرًا.",
    ],
    reactPair: [
      "يسعدنا أن كلًا من {spec} و{spec2} نال إعجابك.",
      "سعداء أن {spec} و{spec2} تركا انطباعًا جيدًا لديك.",
      "أن يُذكر {spec} و{spec2} معًا في تقييم واحد، فهذا أفضل ما نسمعه.",
    ],
    reactTheme: [
      "يسعدنا أن {theme} ترك انطباعًا جيدًا.",
      "نبذل جهدًا كبيرًا في {theme}، لذا يعني لنا هذا الكثير.",
      "جميل أن نسمع أن {theme} كان بالمستوى الذي نطمح إليه.",
    ],
    reactGeneric: [
      "يسعدنا أن الزيارة كلها كانت جميلة.",
      "جميل أن نعرف أنك قضيت وقتًا ممتعًا.",
      "مثل هذه الملاحظات هي أكبر تشجيع لنا.",
      "زيارة موفقة من البداية إلى النهاية، هذا هدفنا كل يوم.",
    ],
    warm: [
      "سنشارك كلماتك مع الفريق.",
      "مثل هذه الملاحظات تدفعنا للأمام.",
      "زبائن مثلك هم سبب استمرار الأعمال الصغيرة.",
      "كلماتك ستصنع يوم أحدهم في مطبخنا.",
    ],
    brand: [
      "هذه هي التجربة التي نريد أن يُعرف بها {store}.",
      "هكذا أردنا لـ{store} أن يكون منذ اليوم الأول.",
      "وصفت {store} كما نتمنى أن يراه الجميع.",
    ],
    kwWoven: [
      "\"{kw}\" هو ما نسعى إليه كل يوم، لذا يعني تقييمك الكثير.",
      "نفخر بـ\"{kw}\"، ويسعدنا أن ذلك وصل إليك.",
      "\"{kw}\" وعدٌ نقطعه على أنفسنا، وتقييمك يقول إننا أوفينا به.",
    ],
    geoWoven: [
      "نفخر بأننا جزء من {geo}، وسعداء أنك وجدتنا.",
      "إن مررت بـ{geo} مجددًا، فأنت تعرف مكاننا.",
      "سعداء بوجودك جارًا لنا في {geo}.",
      "خدمة أهل {geo} شرف لنا، وزبائن مثلك هم السبب.",
      "في {geo} خيارات كثيرة، واختيارك لنا يعني الكثير.",
    ],
    body: [
      "ننتظر زيارتك القادمة.",
      "يسعدنا رؤيتك مرة أخرى.",
      "سنسعى لأن تكون المرة القادمة أفضل.",
      "لا تكن غريبًا.",
      "أحضر صديقًا في المرة القادمة، يسعدنا التعرف عليه.",
    ],
    close: [
      "شكرًا مجددًا!",
      "إلى اللقاء قريبًا.",
      "دمت بخير.",
      "مع خالص الشكر من الجميع هنا.",
    ],
    signoff: [
      "فريق {store}",
      "{store}",
      "الجميع في {store}",
    ],
  },
  mixed: {
    open: [
      "شكرًا على صراحتك، نأخذها بعين الاعتبار.",
      "نقدّر وضوحك معنا.",
      "شكرًا على التقييم المتوازن، مفيد حقًا.",
      "من الجيد أن نعرف ما نجح وما لم ينجح.",
      "التقييم الصادق أهم لنا من العلامة الكاملة.",
    ],
    openNoText: [
      "شكرًا على التقييم، صادق، ونحن نفضّل الصدق.",
      "رأينا التقييم، ونأخذه على محمل الجد.",
      "نقدّر تقييمك حتى وإن لم يكن كاملًا.",
      "شكرًا على التقييم، فحتى العلامة المتوسطة تستحق أن نعرفها.",
      "نفضّل أن نرى هذا على ألا نرى شيئًا، فشكرًا لك.",
    ],
    reactNoText: [
      "من دون تفاصيل نحن نخمّن، ونحن لا نحب التخمين.",
      "لم تكتب شيئًا، لذا لا نعرف أي جزء لم يكن على المستوى.",
      "من الواضح أن شيئًا ما لم يكن كما ينبغي، لكننا لا نعرفه بعد.",
      "لا يمكننا إصلاح ما لا نراه، وحاليًا لا نراه.",
      "هناك فجوة بين هذا التقييم وما نطمح إليه، ونود ردمها.",
    ],
    bodyNoText: [
      "إن كان لديك دقيقة، أخبرنا ما الذي كان سيجعل التجربة أفضل.",
      "سطر واحد عمّا لم يعجبك سيساعدنا كثيرًا.",
      "تواصل معنا وأخبرنا بما نقص، وسنعمل عليه.",
      "نفضّل سماع التفاصيل على تخمينها، فلا تتردد في التواصل.",
    ],
    reactSpec: [
      "نأخذ ملاحظتك حول {spec} على محمل الجد.",
      "نتفق معك بشأن {spec}، وسنحسّنه.",
      "شكرًا لإشارتك إلى {spec}، ننظر فيه بالفعل.",
    ],
    reactPair: [
      "يسعدنا أن {spec} نال إعجابك، ونأسف لأن {spec2} لم يكن بالمستوى. سنحسّنه.",
      "سعداء أن {spec} كان جيدًا، ونأخذ ملاحظة {spec2} على محمل الجد.",
      "{spec} نفخر به؛ و{spec2} سنعمل عليه ابتداءً من الآن.",
    ],
    reactTheme: [
      "يسعدنا أن جزءًا نجح، ونأخذ ملاحظتك حول {theme} على محمل الجد.",
    ],
    reactGeneric: [
      "يسعدنا أن جزءًا نجح، ونسمعك بشأن الباقي.",
      "سنأخذ الجيد ونصلح ما قصّر.",
      "مفيد أن نعرف ما نجح وما يمكن تحسينه.",
    ],
    warm: [
      "مثل هذه الملاحظات هي ما يجعلنا نتطور.",
      "أعطيتنا شيئًا محددًا نصلحه، وهذا أفضل ما يمكن.",
    ],
    brand: [
      "نريد لـ{store} أن يكون أفضل من الزيارة التي حصلت عليها، وسيكون.",
      "هذا ليس مستوى {store} الذي نعرفه، وسنثبت ذلك.",
    ],
    kwWoven: [
      "\"{kw}\" هو معيارنا، وزيارتك لم ترقَ إليه كاملًا. سنصلح ذلك.",
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
    close: [
      "شكرًا مجددًا.",
      "نأمل أن نراك.",
      "نقدّرك.",
    ],
    signoff: [
      "فريق {store}",
      "{store}",
    ],
  },
  negative: {
    open: [
      "نأسف حقًا لأن هذه الزيارة لم تكن كما ينبغي.",
      "نأسف لسماع ذلك، وشكرًا لإخبارنا.",
      "هذه ليست الطريقة التي نريد أن يغادر بها أحد، نعتذر.",
      "لقد قصّرنا هنا، ونعتذر.",
      "أولًا: نعتذر. بلا أعذار.",
    ],
    openNoText: [
      "تقييم كهذا يعني أننا خذلناك في مكان ما، ونعتذر.",
      "نعتذر. هذا التقييم يخبرنا أن الزيارة لم تكن جيدة.",
      "نأسف لرؤية هذا. لا أحد يترك تقييمًا كهذا بلا سبب.",
      "أولًا نعتذر، فهذه العلامة تعني أننا أخطأنا بشكل واضح.",
      "لا نجادل في التقييم، لكننا نود معرفة سببه.",
    ],
    reactNoText: [
      "لم تذكر ما حدث، ونحن نود حقًا أن نعرف.",
      "التفاصيل غائبة عنا، وهذا يجعل الإصلاح صعبًا.",
      "مهما كان الخطأ، نفضّل سماعه على تخمينه.",
      "لا يمكننا تصحيح ما لم نفهمه بعد.",
      "من الواضح أن خطأً وقع من جانبنا، ونريد التفاصيل.",
    ],
    bodyNoText: [
      "أخبرنا من فضلك بما حدث، وسننظر في الأمر بجدية.",
      "إن شاركتنا ما جرى، فسنصحّح الأمر.",
      "تواصل معنا وأخبرنا بما حدث، نود فرصة لإصلاحه.",
      "سطر واحد عمّا حدث سيساعدنا على معالجته.",
    ],
    reactSpec: [
      "أنت محقّ بشأن {spec}، وهو ليس بالمستوى الكافي.",
      "نأسف لأن {spec} خذلك.",
      "لا عذر بشأن {spec}، ونحن ننظر في الأمر.",
    ],
    reactPair: [
      "نأسف بشأن كلٍّ من {spec} و{spec2}، وليس هذا معيارنا.",
    ],
    reactTheme: [
      "أنت محقّ بشأن {theme}، وهو ليس حيث يجب أن يكون.",
      "{theme} ليس معيارنا، ونتحمّل ذلك.",
    ],
    reactGeneric: [
      "هذا ليس المعيار الذي نلتزم به، ونتحمّل مسؤوليته.",
      "ليست هذه التجربة التي نقصدها، ونتحمّل المسؤولية.",
      "نبحث فيما حدث بالضبط.",
    ],
    warm: [],
    brand: [],
    kwWoven: [],
    geoWoven: [],
    body: [
      "نودّ تصحيح الأمر، فيرجى التواصل معنا مباشرة.",
      "تواصل معنا مباشرة وسنبذل جهدنا لإصلاح ذلك.",
      "يرجى التواصل معنا مباشرة لنصحّح الأمر.",
    ],
    close: [
      "شكرًا على منحنا فرصة للتحسّن.",
      "نقدّر صراحتك، وسنتحسّن.",
    ],
    signoff: [
      "فريق {store}",
      "إدارة {store}",
      "{store}",
    ],
  },
};

export const REPLY_POOLS: Record<ReplyLocale, LocalePools> = { en: EN, ja: JA, ar: AR };
