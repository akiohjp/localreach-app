/**
 * Story frames: whole-review narratives with typed keyword slots (EN only).
 *
 * Why this exists (owner read of live RMK / Pitfire output, 2026-09-06): a
 * review built from independent one-liners ("What made it work was X." "One
 * thing I didn't expect was Y." "I'd bookmark this place for Z.") is
 * grammatical sentence by sentence and still reads like a form being filled
 * in. Every fix on top of the slot engine (finite verbs, no colon asides, the
 * conjoin pass, the move cap) attacked a symptom. The cause is that no single
 * author ever wrote the review as one piece.
 *
 * A story frame IS one piece. It is written start to finish by a person, with
 * the places a keyword can sit marked as typed slots, so the sentences refer
 * to each other the way a guest's do ("went in for X ... stuck with it ...
 * glad I did"). Variety comes from many frames, inline choice groups, optional
 * segments, and the keyword rotation the engine already does — not from
 * shuffling sentences.
 *
 * Contract with the engine (review-engine.ts, buildLocalizedReview):
 *   - The engine classifies and RENDERS each keyword (article, service head,
 *     geo article) and hands over plain strings per slot kind; this module
 *     never touches a keyword's text, so the verbatim guarantee is untouched.
 *   - A frame absorbs as many keywords as it has slots for; whatever is left
 *     flows into the engine's existing tail machinery, so no keyword is lost.
 *   - {cat}/{loc} frames are only offered when the engine allows a place
 *     sentence (no geo phrase woven, entity present); both slots always travel
 *     together, so the entity sentence stays all-or-nothing.
 *
 * Frame syntax:
 *   {store} {cat} {loc}            business name, category noun, area or city
 *   {obj1} {obj2} {obj3}           things bought / ordered (items)
 *   {range1}                       a class of goods they sell ("silk rugs")
 *   {attr1} {attr2}                quality noun phrases ("the crispy crust")
 *   {pred1}                        predicate attributes ("perfect for gifts")
 *   {svc1}                         a service received ("the gift wrapping")
 *   {geo1}                         a buyer search phrase ("udon in Dubai")
 *   {aside}                        one flavour-specific concrete sentence
 *   {a|b|c}                        inline choice, resolved per review
 *   [ ... ]                        optional segment: kept only when every slot
 *                                  inside it is filled; a slotless segment is
 *                                  kept on a seeded coin
 *
 * Authoring rules (the grammar hazards are all agreement):
 *   - Only {obj1} (or {attr1} in an attribute-led frame) is mandatory. Every
 *     other slot sits in its own optional segment, as a whole sentence or a
 *     clause that reads cleanly when dropped. Frames with a mandatory second
 *     slot were the 2026-09-06 failure: a store whose taps were all items had
 *     ONE eligible frame, and its closer landed on 28 of 100 drafts.
 *   - Never put "is/was" right after an object, range or attribute slot; a
 *     range is plural ("the room sprays") and an item can be. Use
 *     number-neutral verbs (stood out, did not disappoint, came out, held up)
 *     or a cleft ("X is what I remember").
 *   - Never write "the" before a slot; the engine supplies the article. A
 *     {range1} arrives bare ("their silk rugs", "a range of silk rugs").
 *   - No slot inside a choice group (the choice expander cannot see it), and
 *     no nested optional segments.
 *   - Every sentence has a finite verb; no verbless tags, no colon asides.
 *   - No "best / favourite / hands down"; placement and detail, not rank.
 *   - Two choice groups per frame at the very least: a page of 100 reviews
 *     must not repeat a sentence more than ~12 times.
 *   - Short frames stay under ~40 words, medium under ~72, long under ~125,
 *     with every optional segment in.
 */

import type { Vertical } from "@/lib/review-pools";

export type StoryFamily = "retail" | "restaurant" | "cafe";
export type StorySize = "short" | "medium" | "long";
export type StoryFlavor =
  | "fragrance"
  | "grocery"
  | "doughnut"
  | "bakery"
  | "tea"
  | "coffee"
  | "pizza"
  | "noodles"
  | "none";

export type StoryFrame = {
  size: StorySize;
  text: string;
  /** When set, the frame is only offered to stores of these flavours. */
  flavors?: readonly StoryFlavor[];
};

export function storyFamilyFor(vertical: Vertical): StoryFamily | null {
  if (vertical === "retail" || vertical === "restaurant" || vertical === "cafe") return vertical;
  return null;
}

/**
 * A finer read of the business than the vertical, used only to pick concrete
 * asides ("It's still there at the end of the day" is true of a perfume and
 * false of a rug) and to gate the few frames that assume a box of something
 * to share. Unknown → no aside, the segment is dropped.
 */
export function resolveStoryFlavor(hint: string): StoryFlavor {
  const h = (hint ?? "").toLowerCase();
  if (/perfum|fragranc|scent|attar|\boud\b/.test(h)) return "fragrance";
  if (/grocer|supermarket|\bmarket\b|food store|mini ?mart/.test(h)) return "grocery";
  if (/dough|donut/.test(h)) return "doughnut";
  if (/baker|patisserie|pastry/.test(h)) return "bakery";
  if (/\btea\b|matcha/.test(h)) return "tea";
  if (/pizza/.test(h)) return "pizza";
  if (/udon|ramen|noodle|soba/.test(h)) return "noodles";
  if (/coffee|cafe|café|espresso|roaster/.test(h)) return "coffee";
  return "none";
}

/** One concrete, flavour-true sentence a guest might add. Verbs stay neutral. */
export const STORY_ASIDES: Record<StoryFlavor, readonly string[]> = {
  fragrance: [
    "It's still there at the end of the day.",
    "{Two|A couple of|Three} people asked what I was wearing {that same day|within a week|before lunch}.",
    "It opens {loud|bright} and settles into something {quieter|softer|warmer} after {an hour|a while}.",
    "The bottle {looks the part|earns its place|is heavy in the hand} too.",
    "A little goes a long way.",
    "I've {worn|had} it {most days|every day|nearly every day} since.",
    "It {lasted|was still there} through {a whole workday|a full day out|the evening}.",
    "It doesn't smell like {anything else I own|the usual mall counters|a copy of something}.",
  ],
  grocery: [
    "Prices are fair for imported stuff.",
    "They had things I can't find anywhere else in the city.",
    "The shelves were {full|properly stocked}, not picked over.",
    "Everything was {well within date|fresh}, which is not a given with imports.",
    "The {freezer|chilled} section is {worth a look|better than most}.",
    "I found {two|a few} things I hadn't seen since {home|my last trip}.",
  ],
  doughnut: [
    "Still {soft|fresh} the next morning.",
    "The box {barely|didn't} survive the drive home.",
    "{Nobody|No one} in the office left any.",
    "They were {clearly|obviously} made that {day|morning}.",
    "Not {too sweet|overly sweet}, which I appreciate.",
  ],
  bakery: [
    "Still {soft|fresh} the next morning.",
    "{Nobody|No one} at home left any.",
    "They were {clearly|obviously} baked that {day|morning}.",
    "Not {too sweet|overly sweet}, which I appreciate.",
  ],
  tea: [
    "The tea itself is {properly|clearly} good, not just the packaging.",
    "It made a {better|nicer} gift than I expected.",
    "They explained how to prepare it {without being asked|properly}.",
    "It {tastes|drinks} like the real thing, not a {flavoured|sweetened} version.",
  ],
  coffee: [
    "The coffee {held its own|was properly made|was consistent} too.",
    "Plenty of seats even at {peak|the busy} time.",
    "The wifi {actually worked|held up}.",
    "The milk was {steamed properly|not scorched}, which {matters|I notice}.",
    "It was {quiet|calm} enough to {get work done|talk}.",
    "They {remembered|got} the order right without me repeating it.",
  ],
  pizza: [
    "The crust {held up|was still crisp} by the last slice.",
    "The leftovers {reheated|held up} {fine|well} the next day.",
    "It came out {blistered|properly charred} at the edges, the way it should.",
    "The base was {thin|light} enough that we finished more than we meant to.",
  ],
  noodles: [
    "The broth was {clear|clean} and {not too salty|properly seasoned}.",
    "The noodles had {real|proper} bite to them.",
    "It came out {fast|quickly} and {hot|steaming}.",
    "The portion was {generous|proper} without being silly.",
  ],
  none: [],
};

// ============================================================== RETAIL ===
const RETAIL: StoryFrame[] = [
  // ---- short ----
  { size: "short", text: "Picked up {obj1} from {store} {last week|the other day|on the weekend} and I'm {really|very|genuinely} pleased.[ {aside}][ {attr1} didn't hurt either.] The whole thing was {quick|easy} and {painless|no fuss}." },
  { size: "short", text: "{store} is where I {finally|eventually|at last} found {obj1}. {The staff|The person who served me|Whoever was on} knew exactly what I was after and didn't {push|oversell|talk up} anything else.[ For {geo1}, {this is my answer|I'd start here}.]" },
  { size: "short", text: "Went into {store} {for a gift|to browse|with no real plan|on a whim} and came out with {obj1}. {Glad|Happy|Pleased} I did.[ {aside}][ {attr1} {helped|made it easy} too.]" },
  { size: "short", text: "{Quick|Short|Brief} one for {store}: {obj1} lived up to {what people say|the recommendation|the write-ups}[, and {attr1} did not go unnoticed either].[ {aside}]" },
  { size: "short", text: "I don't buy this kind of thing often, but {store} made it {simple|painless|easy}. Went with {obj1} and {haven't second-guessed it since|have no regrets|would pick the same again}.[ It's {pred1}, which {helps|matters to me}.]" },
  { size: "short", text: "{Two|Three|A couple of} visits to {store} now, and {obj1} has become {my usual|the thing I go back for|the standing order}.[ {aside}][ They {know|really know} their {range1}.]" },
  { size: "short", text: "{Stopped by|Dropped into|Called in at} {store} {on a whim|between errands|after work} and left with {obj1}. It's a {good|solid|proper} shop with {no pressure|no hard sell}, and {they knew their stuff|the advice was straight}.[ {attr1} {stood out|didn't go unnoticed} too.]" },
  { size: "short", text: "If you're {after|looking for|hunting for} {geo1}, {store} is worth {a look|the detour|knowing about}.[ I went in for {obj1} and the {advice|help} alone was worth the trip.][ {attr1} {seals it|does the rest}.]" },
  { size: "short", text: "The thing I'd {flag|mention|point to} about {store} is {attr1}. {That's|It's} {what I'd tell a friend first|why I'd go back|the part that stayed with me}.[ {obj1} {did not disappoint|held up} either.][ {aside}]" },
  { size: "short", text: "{store} {got|gets} {obj1} right[, and {attr1} {seals it|does the rest}].[ {aside}][ They carry a {good|solid} range of {range1}.]" },
  { size: "short", text: "Went back to {store} for {obj1} and it {held up|was as good as the first time|hasn't slipped}.[ {aside}] {Same|The same} {friendly|straight|easy} service as before.[ It's {pred1} too.]" },
  { size: "short", text: "{Nothing complicated|Not much to it}: {store} had {obj1}, {the price was|prices were} {clear|fair}, and {I was out in ten minutes|nobody wasted my time}.[ They {handled|sorted} {svc1} on the spot.][ {aside}]" },

  // ---- medium ----
  { size: "medium", text: "I'd been meaning to {try|check out|get to} {store} for a while and finally went in {last week|the other day|this month}. {Ended up with|Came away with|Left with} {obj1}[ and {obj2}], and it turned out to be {a good call|the right choice|money well spent}.[ {aside}][ {attr1} {stood out|didn't go unnoticed} too.] {The staff|The person who helped me|Whoever was on} {took their time|actually listened|asked what I wanted} instead of pushing {the most expensive thing|whatever was new|the display stock}, which {is rarer than it should be|I appreciated|made the difference}.[ For {geo1}, {this is where I'd send people|I'd start here}.]" },
  { size: "medium", text: "{Went to|Visited|Called in at} {store} looking for {a gift|something for myself|something specific} and {ended up with|settled on|went with} {obj1}. {They let me|I was able to} {try|compare|test} a few before deciding, and {nobody rushed me|there was no pressure at any point|nobody hovered}.[ {attr1} didn't hurt either.][ They {sorted|handled} {svc1} without me asking.][ {aside}] {Would|I'd} {happily|gladly} go back.[ If you're after {geo1}, {start here|this is the place}.]" },
  { size: "medium", text: "{Honest|Straight|Plain} review of {store}: I {bought|picked up|took home} {obj1}[ and {obj2}], the {advice|help} was {genuinely|actually} useful, and I wasn't {talked into|sold|steered toward} anything I didn't want.[ They handled {svc1} {without me asking|without any fuss}.][ {attr1} {stood out|is worth a mention} too.] {That's|And that's} {about all I ask from a shop|exactly what I want from a shop like this}.[ {aside}]" },
  { size: "medium", text: "{store} {got|earned} a repeat visit from me {this month|already|within the week}. {First|Last} time I {went with|tried|bought} {obj1}[; this time {obj2}][, with {obj3} next on the list]. It was {consistent|the same standard} both times[, and {attr1} {again|as before} stood out].[ {aside}][ They {know|really know} their {range1}.]" },
  { size: "medium", text: "I was {skeptical|not expecting much|unsure} going into {store}, {mostly|partly} because {I'd been let down elsewhere|this kind of shop can be hit and miss}. {obj1} {changed my mind|won me over|settled it} {fairly quickly|within a day|on the spot}[, and {obj2} {came close|wasn't far behind}].[ {aside}][ Add {attr1} and it's {an easy recommendation|hard to fault}.][ It's {pred1}, {which|and that} {matters|counts}.]" },
  { size: "medium", text: "If you're {hunting|searching|looking} for {geo1}, {store} {belongs on the list|is where I'd start|is the one I'd name}. I {went in for|asked about} {obj1}, got {a straight answer|honest advice} rather than a pitch, and {left|walked out} with {exactly what I wanted|something I actually use}.[ {aside}][ {attr1} {rounds it off|is the finishing touch}.][ They carry a {good|solid} range of {range1}.]" },
  { size: "medium", text: "{Two|A couple of} things stood out at {store}. The first was {obj1}, which {lived up to|matched} {the description|what I'd heard}.[ The second was {svc1}, {done|handled} properly and {without me having to chase|without any back and forth}.][ {attr1} {didn't go unnoticed|stood out} either.][ {aside}] They're small things, but they're why I'd go back." },
  { size: "medium", text: "I'd go back to {store} for {obj1} alone, but {attr1} is what {I remember most|stayed with me|I'd mention first}.[ {aside}] {Prices|The prices} were {clear|fair} {from the start|up front}, and {nobody|no one} tried to {upsell|oversell} me.[ If you're after {geo1}, {this is the place|start here}.]" },
  { size: "medium", text: "{Nice|Good|Reassuring} to have this kind of {cat} in {loc} that {actually|really} {knows its stuff|does this properly}. I picked up {obj1}[ and {obj2}] at {store} and {the whole thing|it} was {easy|painless}.[ {aside}][ {attr1} {stood out|didn't go unnoticed} too.] There was {no hard sell|zero pressure}, just {honest|straight} answers." },
  { size: "medium", text: "Went to {store} with {a friend|my sister|my partner|a colleague} {on Saturday|last weekend|after lunch|on a day off}. They went for {obj1}[ and I {took|went for} {obj2}]; {neither of us|nobody} regretted it.[ {aside}][ {attr1} {helped|made a difference} too.] {The staff|The team} were {patient|helpful} while we {dithered|made up our minds|compared}, which {took a while|says a lot}." },
  { size: "medium", text: "{store} does the {basics|simple things|fundamentals} well. I {bought|picked up} {obj1}[, it's {pred1}], and {the price was|prices were} {clear|fair} {up front|from the start}.[ {aside}][ They {handled|took care of} {svc1} {as promised|without a hitch}.] {Not much more to say|That's really all there is to it}, {which is a compliment|and that's a good thing}." },
  { size: "medium", text: "{Been|Went} to {store} {twice|a few times|three times} now, and {obj1} is what keeps me coming back. {Prices are|Pricing is} {honest|fair}, {the range|the selection} is {well chosen|not overwhelming}[, and {attr1} {seals it|does the rest}].[ {aside}][ They {know|really know} their {range1}.]" },
  { size: "medium", text: "{Ordered|Got} {obj1}[ and {obj2}] from {store} for {my mother|a friend's birthday|the house|a colleague}. Everything {arrived|came} {intact and|properly packed and} {looking the part|exactly as described}[, and {svc1} was {quick|as promised}].[ {aside}] {The person|Whoever} I spoke to {before ordering|beforehand} {actually knew|knew} the products, which {made the choice easy|helped}.[ {attr1} {didn't hurt|helped} either.]" },
  { size: "medium", text: "{Second|Third} time at {store} and {the standard|it} {hasn't slipped|held up}. {obj1} again[, plus {obj2} this time]. {The staff|Whoever was on} {remembered|recognised} me, which {I didn't expect|was a nice touch}.[ {aside}][ {attr1} is {still|again} the part I'd {mention|point to} first.][ For {geo1}, {this is my answer|I'd start here}.]" },
  { size: "medium", text: "What I'd {mention|point to} first about {store} is {attr1}[, then {attr2}]. I {went in|dropped in} {expecting|braced for} the usual {pitch|hard sell} and got {none of it|the opposite}.[ {obj1} {came home with me|was what I left with}.][ {aside}][ They {handled|sorted} {svc1} {without me asking|on the spot}.] {Prices|The prices} {stayed where they said|were clear}, and I was {out|done} in {twenty minutes|no time}." },

  // ---- long ----
  { size: "long", text: "I'd walked past {store} {a few times|for weeks|more than once} before going in, and I'm {annoyed|a bit annoyed} I waited. {The first thing I bought was|I started with} {obj1}[, then went back for {obj2}][ and {obj3}].[ {What I didn't expect was|The surprise was} {attr1}, the kind of thing you only notice when it's done right.][ They {sorted|handled} {svc1} without me having to ask.][ {aside}] {Nobody hovered|No pressure at any point|Nobody followed me around}, {the prices were|pricing was} {clear|straightforward}, and {when I had questions|whenever I asked something} I got {a proper answer|an actual answer} rather than a {sales line|pitch}.[ If you're after {geo1}, {this is where I'd send you|start here}.] I'd {easily|happily} recommend it." },
  { size: "long", text: "{Long overdue|Overdue} review for {store}. I've been buying {obj1} {here|from them} for {months|a while|most of the year} now[, and {recently|lately} added {obj2}].[ {What keeps me coming back|The reason I keep coming back} is {partly|mostly} {attr1}, {but also|and} {the fact that|that} {nobody ever tries to upsell me|I've never once been oversold}.][ They've been {reliable|consistent} with {svc1} every time.][ {aside}][ {If you're after|For} {geo1}, {this is the place I'd send you|I'd start here}.][ They {know|really know} their {range1}.] {I've|We've} {sent|pointed} {a couple of friends|two friends} {their way|here} already." },
  { size: "long", text: "First time at {store} and it {went better than expected|was better than I expected}. I went in {half-decided|fairly sure} on {obj1} and {the staff|the person helping me} {talked me through|walked me through} {the options|a few alternatives} {without any pressure|patiently}; I stuck with {obj1}[ and added {obj2}], and I'm glad I did.[ {aside}][ {attr1} {stood out|was obvious} {from the start|straight away}.][ {attr2} {backed it up|matched it}.] {The whole visit|It all} took {twenty minutes|less than half an hour} and I left {knowing exactly what I'd bought|with exactly what I wanted}.[ It's {pred1} too, {which|and that} {matters|counts}.] {I'll be|Will be} {back|going back}." },
  { size: "long", text: "Needed {a gift|a present} {for a friend|for my sister|for a colleague|for my father} and {a friend|a colleague} {suggested|recommended} {store}. I went with {obj1}[ and {obj2}] and {they|the shop} {wrapped it properly|took care of the wrapping} {without me asking|on the spot}. {The person|Whoever} I dealt with {knew the range|knew their products} {inside out|properly} and {asked the right questions|actually asked what the person was like} before {suggesting|recommending} anything.[ {aside}][ {attr1} didn't hurt either.][ They made {svc1} {quick|painless} too.] The gift {landed|went down} well, {which is what counts|which is the whole point}, and I've {already been back for myself|since bought something for myself}." },
  { size: "long", text: "{Genuinely|Honestly} {good|pleased} to find this kind of {cat} in {loc}. {store} {stocks|carries} {obj1}[ and {obj2}], which I'd {struggled|been struggling} to find {locally|anywhere nearby}, and {the staff|the team} {know|actually know} what they're talking about. {I asked|We asked} {a lot of|plenty of} questions and {got|had} {straight|clear} answers every time.[ {aside}][ They made {svc1} {quick|painless} too.][ They carry a {good|solid} range of {range1}.] {Pricing|The pricing} felt {fair|reasonable} for what I got[, and {attr1} {made|makes} {the whole experience|it} feel like {a proper shop rather than a counter|somewhere run by people who care}]." },
  { size: "long", text: "I'd {searched|been searching} for {geo1} for {a while|weeks|months} and {store} is where {the search|it} ended. {Went in for|Tried} {obj1}[ and {obj2}] and {wasn't disappointed|came away impressed}[, with {obj3} next on the list]. {The staff|The team} {let me|were happy to let me} {take my time|try before buying}, {explained|answered} {everything|every question} {clearly|properly}, and never pushed for a bigger spend.[ {aside}][ {attr1} {rounds it off|is the finishing touch}.][ They carry a {good|solid} range of {range1}.] {I've|We've} {already|since} told {two people|a few friends} {about it|to go}." },
  { size: "long", text: "It's a {solid|consistently good|reliable} {place|shop}. {Over the last few months|In the last year|Since spring} I've {picked up|bought} {obj1}[ and {obj2}] from {store}, and {every time|each time} {the experience|the service} has been {the same|consistent}: {helpful|attentive} without hovering, {clear|honest} about {prices|what things cost}, and {quick|efficient} at the till.[ They handle {svc1} {exactly as advertised|reliably}.][ It's {pred1}, {and that shows|which you can tell}.][ {aside}][ {attr1} is {the detail|the part} I'd {single out|mention} if someone asked.] I'd recommend it {without hesitation|easily}." },
  { size: "long", text: "{store} came recommended by {a colleague|a neighbour|a friend|my sister} and it {held up|lived up to it}. I went in {for|after} {obj1}[, came out with {obj2} as well], and {the whole thing|the visit} took {about twenty minutes|less than half an hour} {without feeling rushed|and never felt rushed}.[ {What I noticed|What struck me} was {attr1}; {you don't get that everywhere|that's not a given}.][ {attr2} {stood out|held up} too.][ {aside}] {Prices|The prices} were {clear|fair} and {nobody|no one} tried to {upsell|oversell} me, which {is exactly how it should be|I appreciated more than I expected}.[ For {geo1}, {this is where I'd send people|I'd start here}.] {I've|We've} {already|since} been back." },
  { size: "long", text: "{Three|Two} visits to {store} {in a month|in three weeks|since I found it}, which {says most of it|tells you enough}. {I started with|The first time it was} {obj1}[, then {obj2}][, and {obj3} on the last visit]. {Each time|Every time} {the staff|the team} {remembered|recognised} me, {answered|took} my questions {properly|seriously}, and {let me|were happy to let me} {take my time|browse without hovering}.[ {aside}][ {attr1} {stood out|held up} {every time|throughout}.][ {attr2} {backed it up|matched it}.][ They {know|really know} their {range1}.] {Prices|The prices} are {honest|fair}, and {I've|we've} {already|since} sent {friends|two friends} {their way|there}." },
  { size: "long", text: "What sets {store} apart is {attr1}[, and {attr2} {right behind it|close behind}]. I {went in|dropped in} {expecting|braced for} the usual {hard sell|pitch} and got {the opposite|none of it}: {questions about what I actually wanted|straight answers}, {time to think|no rush}, and {prices|pricing} that {didn't move|stayed where they said}.[ {obj1} {came home with me|was what I left with}.][ Next time it'll be {obj2}.][ They {handled|sorted} {svc1} {without me asking|on the spot}.][ {aside}][ For {geo1}, {I'd start here|this is my answer}.] I'd {send|point} {anyone|friends} {their way|here}." },
];

// ========================================================== RESTAURANT ===
const RESTAURANT: StoryFrame[] = [
  // ---- short ----
  { size: "short", text: "{Dinner|Lunch} at {store} {last night|on Friday|this week|on Sunday}: {had|ordered} {obj1} and that was {exactly|just} what I wanted. It was {quick|easy} and {no fuss|painless}, and I'd go again.[ {aside}]" },
  { size: "short", text: "{Stopped in|Went to|Ended up at} {store} for a {quick|late} {lunch|bite} and {ended up|left} {very|really|properly} happy. {obj1} {did the job|hit the spot}[, and {attr1} didn't hurt].[ {aside}]" },
  { size: "short", text: "{store} {keeps it simple|does the simple things right}. {obj1} {came out|arrived} {hot|fast|quickly} and {did not disappoint|went down well}, and the {bill|price} was {fair|reasonable}.[ It's {pred1} too.]" },
  { size: "short", text: "I'd go to {store} for {obj1} alone[, and {attr1} {seals it|makes the difference}].[ {aside}][ They {know|really know} their {range1}.]" },
  { size: "short", text: "If you're {after|looking for} {geo1}, {store} is {a safe bet|worth knowing about}.[ {obj1} {did not disappoint|went down well}.] {The service|The staff} {kept up|kept pace} even {on a busy night|when it filled up}." },
  { size: "short", text: "{Good|Solid|Proper} {meal|dinner} at {store}. What {stood out|I remember} most is {attr1}, which {you don't get everywhere|is rarer than it should be}.[ {obj1} {held up|did not disappoint} too.] {Would|I'd} {happily|gladly} go back." },
  { size: "short", text: "{We|My family} {tried|went to} {store} {on a recommendation|because a friend kept mentioning it}. {Shared|Ordered} {obj1}[ and {obj2}], cleared the plates, and {nobody|no one} had a complaint, which {never happens|is rare with us}." },
  { size: "short", text: "{Weeknight|Midweek} dinner at {store} and it {delivered|did the job}. {obj1} {came out|arrived} {quickly|fast}[, {attr1} {as promised|as advertised}], and we were {out|done} in {under an hour|forty minutes} {without feeling rushed|and didn't feel rushed}." },
  { size: "short", text: "Went back to {store} for {obj1} and it {held up|was as good as the first time}.[ {aside}] {Same|The same} {friendly|relaxed} service as before.[ For {geo1}, {this is my answer|I'd start here}.]" },
  { size: "short", text: "{Quick|Short} one: {store} {got|gets} {obj1} right[, and {attr1} {does the rest|seals it}].[ {aside}] {Nothing fancy|No fuss}, {just|and} {done properly|done well}." },

  // ---- medium ----
  { size: "medium", text: "{Went to|Tried} {store} {last weekend|on Saturday|on Thursday} with {friends|the family|colleagues}. We {ordered|went with} {obj1}[ and {obj2}][ plus {obj3} to share], and {everything|it all} {came out|arrived} {together|at the same time} and {hot|properly hot}.[ {aside}][ {attr1} stood out {from the start|straight away}.] {Service|The service} was {friendly|warm} without {hovering|being over the top}, and the bill {came in|was} {lower than I expected|fair for what we ate}. {We'll|Will} be back." },
  { size: "medium", text: "{Honest|Straight} review of {store}: I {ordered|had} {obj1}, {have no complaints|couldn't fault it}, and {the rest of the table|everyone else} {said the same about|felt the same about} {theirs|what they had}.[ {obj2} {went down|got finished} {just as fast|equally fast}.] {The place|It} was {busy|full} but {the pace|service} {never dropped|held up}[, and {attr1} {stood out|was noticeable} {throughout|the whole time}].[ {aside}] {Would|I'd} recommend it {without hesitation|easily}." },
  { size: "medium", text: "I'd {heard|read} good things about {store} and it {held up|lived up to them}. I went {mainly|mostly} for {obj1}[, ended up sharing {obj2} as well], and {left|walked out} {full and happy|genuinely happy}.[ {aside}][ {attr1} {made|makes} a {real|noticeable} difference; {you can tell|it's obvious} {someone in the kitchen cares|they take it seriously}.] {Prices|The prices} are {fair|reasonable} for {the portions|what you get}, and the staff were {friendly|relaxed} {without being|and not} {pushy|over the top}." },
  { size: "medium", text: "If you're {looking for|after} {geo1}, {store} is {the place I'd send you|my answer}. {Had|Ordered} {obj1}[ and {obj2}], and {everything|it all} {came out|arrived} {done properly|the way it should}.[ {aside}] {The room|The place} was {lively|busy} without being loud, {the staff|the team} {kept things moving|stayed on top of things}[, and {attr1} {stood out|didn't go unnoticed}]. It's an easy recommendation." },
  { size: "medium", text: "{Lunch|Dinner} at {store} {with a colleague|with my partner|on my own} {yesterday|earlier this week|on Tuesday}. {Went with|Picked} {obj1}, which {arrived|came} {fast|quickly} and {hot|properly hot}[, and {obj2} {on the side|to share}].[ {aside}][ {attr1} {stood out|was the detail I noticed}.] {Nobody|No one} {rushed us|hurried us} even though {the place|it} was {filling up|busy}. I'd go back for {obj1} alone." },
  { size: "medium", text: "{Good|Nice} to have this kind of {cat} in {loc}. {store} {does|makes} {obj1}[ and {obj2}] {properly|the way they should be}, {service|the service} is {quick|attentive} {without being|but not} {pushy|in your face}, and {prices|the prices} are {fair|sensible} for {the area|what you get}.[ {aside}][ {attr1} is what {sets it apart|I'd mention first}.]" },
  { size: "medium", text: "{store} is {pred1}, {and|which} {for us|for a family} {matters|counts for a lot}. We {had|shared} {obj1}[ and {obj2}], the {kids|children} {ate|finished} {everything|theirs}, and {the staff|the team} were {patient|easy-going} {with the chaos|about the mess}.[ {aside}][ {attr1} {helped|didn't hurt} too.] {Would|I'd} bring {people|friends} here {again|without hesitation}." },
  { size: "medium", text: "{Been|Went} to {store} {twice|three times} {this month|in two weeks}, which {tells you|says} {most of it|enough}. I had {obj1} both times[ and {obj2} once], and {no complaints|nothing to fault} either time.[ {aside}][ {attr1} {stood out|held up} {both times|each time}.] The staff {remembered us|recognised us} on the second visit, which {was a nice touch|I didn't expect}." },
  { size: "medium", text: "It's a {solid|reliable} {spot|place}. {store} {does|handles} {obj1} {well|properly}[ and {obj2} {even better|just as well}], {portions|the portions} are {generous|proper}, and the {bill|total} {never surprises you|is what you expect}.[ {aside}][ {attr1} {doesn't hurt|helps} either.][ They ran {svc1} {smoothly|without a hitch}.] I'd recommend it." },
  { size: "medium", text: "{Booked|Went to} {store} for {a birthday|an anniversary|a family dinner} and it {went well|was the right call}. {Ordered|Shared} {obj1}[ and {obj2}] between us, {nothing|not one plate} came back {unfinished|with anything left}, and {the staff|the team} {handled|managed} {a table of six|a big table} {without missing anything|without a hitch}.[ {aside}][ {attr1} {rounded it off|was the finishing touch}.][ They {know|really know} their {range1}.]" },
  { size: "medium", text: "What I'd {mention|point to} first about {store} is {attr1}[, then {attr2}]. {We|I} {went in|came in} {on a busy night|at peak time} and {still|even then} {got looked after|never waited long}.[ {obj1} {did not disappoint|held up} either.][ {aside}] {Prices|The prices} {are|were} {fair|sensible}, and {nobody|no one} {rushed|hurried} us out.[ For {geo1}, {this is my answer|I'd start here}.]" },
  { size: "medium", text: "{Takeaway|Delivery} from {store} {on Friday|last night|midweek} and it {travelled|held up} {fine|well}. {obj1} {was still hot|arrived hot}[, and {obj2} {survived the trip|came through intact}].[ {aside}][ They {handled|took care of} {svc1} {as promised|without a hitch}.] {The portions|Portions} were {generous|proper}[, and {attr1} {came through|held up} even out of the box]. {We'll|I'll} order again." },

  // ---- long ----
  { size: "long", text: "{Finally|At last} made it to {store} after {months|weeks} of {friends|people} {telling me|going on} about it, and {it held up|the hype was justified}. We {started with|ordered} {obj1}[, then {obj2}][, and {obj3} {for the table|to share}]; {everything|it all} {came out|arrived} {hot|together} and {nobody|no one} {waited long|had to wait} between courses.[ {aside}][ {attr1} {stood out|was the first thing I noticed}.][ {attr2} {stood out|held up} too.] {Service|The service} was {friendly|warm} without {hovering|being over the top}, {the room|the place} was {busy|full} but {not loud|still easy to talk in}, and the bill {came in|was} {lower than I braced for|fair for what we had}.[ For {geo1}, {this is where I'd send people|I'd start here}.] {We've|I've} {already|since} {booked|planned} {a second visit|the next one}." },
  { size: "long", text: "{Long|Long-overdue} review for {store}, {a place|somewhere} we've {been to|eaten at} {a few times|more than a few times} now. {The regular order is|We usually get} {obj1}[ and {obj2}], and {the standard|it} {hasn't slipped|has stayed the same} once.[ {obj3} {joined|got added to} the list {recently|last month}.][ {What keeps us coming back|The reason we keep coming back} is {partly|mostly} {attr1}, but also {that|the fact that} {the staff|the team} {actually remember|remember} {us|regulars} and {don't|never} rush anyone out.][ They've been {reliable|consistent} with {svc1} every time.][ {aside}][ They {know|really know} their {range1}.][ {If you're|For anyone} {looking for|after} {geo1}, {this is|it's} {the place I'd send you|where I'd start}.]" },
  { size: "long", text: "First {visit|time} at {store} and {I'm|we're} {converted|impressed}. {I'd|We'd} {planned on|come for} {obj1}[ and {the waiter|our server} {suggested|pointed us to} {obj2} {as well|to go with it}, which {turned out to be|was} the right call][; {obj3} {rounded it off|finished the meal}]. {Everything|Each dish} {came out|arrived} {at a sensible pace|when it should}, {nothing|no dish} {sat around|went cold}, and the {kitchen|pace} {kept up|held} even {on a packed night|when the place filled up}.[ {aside}][ {attr1} {stood out|was obvious} from the {first plate|start}.][ {attr2} {backed it up|matched it}.] {Prices|The prices} {are|were} {fair|reasonable} for what you get, and {the staff|the team} were {genuinely|properly} {friendly|welcoming} {rather than|not just} {polite for the tips|going through the motions}. {We'll|I'll} be back {soon|before long}." },
  { size: "long", text: "{Glad|Happy} to have this kind of {cat} in {loc}; {store} {fills|filled} a gap. We {ordered|had} {obj1}[ and {obj2}] and {it all|everything} {held up|delivered}[, with {obj3} {as the surprise|the surprise of the night}].[ {attr1} {stood out|is the standout}; {you can tell|it's clear} {someone|the kitchen} {takes it seriously|cares about the details}.][ {attr2} {came close|isn't far behind}.][ {aside}] {Service|The service} {kept pace|kept up} {on a busy night|even when it was full}, {nobody|no one} {rushed us|hurried us}, and the bill was {fair|reasonable}. {I've|We've} {already|since} {told|sent} {friends|two friends} {about it|here}." },
  { size: "long", text: "{I'd|We'd} {been looking for|searched around for} {geo1} for {a while|months} and {store} {ended the search|is where it ended}. {Went with|Ordered} {obj1}[ and {obj2}][, plus {obj3} {to share|for the table}], and {everything|all of it} {came out|arrived} {hot|together} and {properly done|done right}.[ {aside}][ {attr1} {stood out|was the detail I noticed}.][ {attr2} {backed it up|matched it}.] {The staff|The team} were {relaxed|friendly} and {quick|on it}, {the place|the room} was {busy|full} but {comfortable|not loud}, and {the prices|prices} were {fair|sensible} for {what we had|the portions}. It's an easy {recommendation|place to recommend}." },
  { size: "long", text: "{store} is {pred1}, {which|and that} {matters|counts} {when you've got|with} {kids|a group} in tow. We {had|ordered} {obj1}[ and {obj2}], {the kids|everyone} {finished|cleared} {theirs|their plates}, and {the staff|the team} were {patient|easy} {about the noise|with the chaos}.[ They {handled|took care of} {svc1} {smoothly|without a hitch}.][ {aside}][ {attr1} {stood out|didn't go unnoticed}.] The bill {didn't surprise us|was fair}, {nobody|no one} rushed us, and {we were|the whole table was} {out|done} {before the kids got restless|in good time}. {Would|I'd} bring {people|friends} here {again|without hesitation}." },
  { size: "long", text: "{store} came recommended by {a colleague|a neighbour|a friend} and it {held up|lived up to it}. We went in {for|after} {obj1}[, ended up adding {obj2}][ and {obj3}], and {nothing|not one dish} {disappointed|missed}.[ {What I noticed|What struck me} was {attr1}; {you don't get that everywhere|that's not a given}.][ {attr2} {stood out|held up} too.][ {aside}] {The staff|The team} {checked in|came by} at the right moments {without hovering|and left us alone otherwise}, {portions|the portions} were {generous|proper}, and the bill was {what I expected|fair}.[ For {geo1}, {this is my answer|I'd start here}.] {I've|We've} {already|since} been back." },
  { size: "long", text: "What sets {store} apart is {attr1}[, with {attr2} {close behind|right behind it}]. We {turned up|arrived} {without a booking|on a busy night} and {still|even then} got {a table|seated} {within ten minutes|quickly}[; {obj1} {came out|arrived} {fast|hot} and {did not disappoint|held up}][, and {obj2} {went down|got finished} {just as fast|equally fast}].[ {aside}][ They ran {svc1} {smoothly|as promised}.] {Prices|The prices} {are|were} {fair|reasonable} for {the portions|what you get}, the staff {kept|held} the pace {without rushing anyone|even at full tilt}, and {we|I} {left|walked out} {already planning the next visit|talking about coming back}." },
];

// =============================================================== CAFE ===
const CAFE: StoryFrame[] = [
  // ---- short ----
  { size: "short", text: "{Stopped by|Popped into|Called in at} {store} {this morning|on the way to work|after lunch|mid-afternoon} for {obj1} and {it|that} {hit the spot|did the job}.[ {attr1} didn't hurt either.][ {aside}]" },
  { size: "short", text: "I'd go to {store} for {obj1} alone[, and {attr1} {seals it|makes it an easy choice}].[ {aside}][ They {know|really know} their {range1}.]" },
  { size: "short", flavors: ["doughnut", "bakery"], text: "{Grabbed|Picked up} {obj1} from {store} {for the office|for the family|for a friend} and {it|the box} was gone {within minutes|in about ten minutes}. That says {it all|everything}, really.[ {aside}]" },
  { size: "short", text: "{store} {gets|does} {obj1} {right|exactly right}[, and {attr1} does the rest].[ {aside}][ For {geo1}, {this is my answer|I'd start here}.]" },
  { size: "short", text: "If you're {after|looking for} {geo1}, {store} is {worth knowing|the one I'd name}.[ {obj1} {did not disappoint|went down well}.][ {attr1} didn't hurt.][ {aside}]" },
  { size: "short", text: "{Sat in|Worked from} {store} for {an hour|a couple of hours} {this afternoon|today|on Sunday}.[ {obj1} {kept me going|was exactly what I needed}.] {Nobody|No one} {rushed me|hurried me}[, and {attr1} {made it easy to stay|is why I stayed}].[ {aside}]" },
  { size: "short", text: "{Went|Came} back to {store} {for the second time this week|again already}. {I had|Went for} {obj1} again, and {no regrets|I have no complaints}.[ {aside}][ It's {pred1} too.]" },
  { size: "short", text: "{Quick|Short} one for {store}: {obj1} {lived up to|matched} {what I'd heard|the recommendation}, and {the staff|the people behind the counter} were {lovely|genuinely friendly}.[ {aside}]" },
  { size: "short", text: "{Good|Nice} {spot|place}, this. {store} had {obj1} ready in {a couple of minutes|no time}[, {attr1} {helped|didn't hurt}], and {the prices|prices} {were|are} {fair|sensible}.[ {aside}]" },
  { size: "short", text: "What I'd {mention|point to} first about {store} is {attr1}.[ {obj1} {held up|did not disappoint} too.] {It's|That's} {why I keep going back|what I'd tell a friend}.[ {aside}]" },

  // ---- medium ----
  { size: "medium", text: "{Been|Went} to {store} {a few times|twice|three times} now and {it's|they've been} {consistent|reliable} every time. I {usually|always} get {obj1}[, or {obj2} when I'm sharing], and {the staff|whoever's on} {remember|remembered} {my order|the order} {by the second visit|already}.[ {aside}][ {attr1} is {a big part of it|what makes it work}.][ They {know|really know} their {range1}.]" },
  { size: "medium", flavors: ["doughnut", "bakery"], text: "{Picked up|Ordered} {obj1} from {store} for {a birthday|the office|a small get-together}[ and added {obj2} {for good measure|as well}]. {Everything|It all} {arrived|came} {fresh|properly packed} and {looked|was} {exactly like the photos|as good as it looked online}, and {it|the lot} was gone {within the hour|before the meeting ended}.[ {aside}][ They kept {svc1} {smooth|painless}.][ {attr1} didn't hurt either.] {I'll|Will} be {ordering|going back} {again|before long}." },
  { size: "medium", text: "{Sat down|Stopped} at {store} {with a friend|on my own|with my laptop} {on Saturday|midweek|on a slow morning}. {Had|Went for} {obj1}[ and {obj2}] and {stayed|ended up staying} {far longer than planned|a good hour longer than I meant to}[, {mostly|partly} because {attr1} made it easy].[ {aside}] {Prices|The prices} are {fair|reasonable} for {the area|what you get}, {the staff|the team} were {friendly|relaxed} without {hovering|fussing}, and {it wasn't|it never got} {too loud|noisy} to {talk|think}. {Would|I'd} {happily|gladly} go back." },
  { size: "medium", text: "If you're {looking for|after} {geo1}, {store} is {where I'd start|the place I'd name}. {Went for|Tried} {obj1}[ and {obj2}] and {wasn't disappointed|left happy}.[ {aside}] {The place|It} was {busy|full} but {the queue moved|things moved} {quickly|fast}, {the staff|the team} were {cheerful|friendly} {despite the rush|even under pressure}[, and {attr1} {stood out|didn't go unnoticed}]. {I'd|Would} recommend it {without hesitation|easily}." },
  { size: "medium", text: "{Nice|Good} to have this kind of {cat} in {loc}. {store} {gets|does} {obj1}[ and {obj2}] {right|properly}, {the service|service} is {quick|friendly} without being {rushed|abrupt}, and {prices|the prices} are {fair|sensible}.[ {aside}][ {attr1} is what {I'd mention first|sets it apart}.]" },
  { size: "medium", text: "{store} is {pred1}, {which|and that} {matters|counts} {more than people think|to me}. {Took|Brought} {obj1}[ and {obj2}] {to a friend's|to the office|home}, and {everything|the lot} {went down|disappeared} {fast|quickly}.[ {aside}] {The staff|The team} {packed it|boxed it} {carefully|properly} {without me asking|on the spot}[, and {attr1} {rounded it off|didn't hurt either}]." },
  { size: "medium", text: "{Honest|Straight} review of {store}: I {had|tried} {obj1}, {have no complaints|couldn't fault it}, and {the coffee|the drinks} {held up|kept up} too.[ {obj2} {went|got finished} {just as fast|equally fast}.] {The place|It} {gets|was} {busy|full} {mid-morning|around lunch} but {nobody|no one} {rushed us|hurried us}[, and {attr1} {stood out|was noticeable} {throughout|the whole time}].[ {aside}] It's an easy {recommendation|place to recommend}." },
  { size: "medium", text: "I'd {heard|read} good things about {store} and it {held up|lived up to them}. Went {mainly|mostly} for {obj1}[, ended up with {obj2} as well], and {left|walked out} {happy|glad I came}.[ {aside}][ {attr1} {made|makes} a {real|noticeable} difference; {you can tell|it's obvious} {someone cares|they take it seriously}.] {Prices|The prices} are {fair|reasonable} for what you get, and the staff were {friendly|relaxed} {without being|and not} {pushy|over the top}." },
  { size: "medium", text: "{Second|Third} time at {store} and {the standard|it} {hasn't slipped|held up}. {obj1} again[, plus {obj2} this time]. {The staff|Whoever was on} {remembered|recognised} me, which {I didn't expect|was a nice touch}.[ {aside}][ {attr1} is {still|again} the part I'd {mention|point to} first.][ For {geo1}, {this is my answer|I'd start here}.]" },
  { size: "medium", text: "What I'd {mention|point to} first about {store} is {attr1}[, then {attr2}]. {I|We} {came in|turned up} {at peak time|on a busy morning} and {still|even then} {got served quickly|never waited long}.[ {obj1} {did not disappoint|held up} either.][ {aside}] {Prices|The prices} {are|were} {fair|sensible}, and {nobody|no one} {rushed|hurried} us.[ They {know|really know} their {range1}.]" },
  { size: "medium", text: "{Breakfast|Brunch|A slow coffee} at {store} {on Sunday|on a day off|before work} and it {set the day up|was the right call}. {obj1} {came out|arrived} {quickly|fast}[, {obj2} {shortly after|right behind it}], and {nothing|none of it} {felt|tasted} {rushed|thrown together}.[ {aside}][ {attr1} {stood out|is the detail I noticed}.] {The staff|The team} were {easy|relaxed} and {quick|on it}, and {I'd|we'd} {go back|do it again} {without thinking|any weekend}." },

  // ---- long ----
  { size: "long", text: "{Finally|At last} tried {store} after {walking past|hearing about} it for {weeks|months}. {Went for|Started with} {obj1}[, then {obj2}][, and took {obj3} {home|to the office}]; {everything|all of it} was {fresh|properly fresh} and {nothing|none of it} {felt|tasted} like it had been {sitting around|out all day}.[ {aside}][ {attr1} {stood out|was the first thing I noticed}.][ {attr2} {stood out|held up} too.] {The staff|The team} were {friendly|cheerful} {without being over the top|and quick}, {the place|it} was {busy|full} but {the line|the queue} moved, and {the prices|prices} {were|are} {fair|reasonable} for what you get.[ For {geo1}, {this is where I'd send people|I'd start here}.] {I've|We've} {already|since} been back {twice|again}." },
  { size: "long", text: "{Long-overdue|Overdue} review for {store}, {a place|somewhere} I've been {going to|stopping at} for {months|a while} now. I usually get {obj1}[, or {obj2} when I'm {sharing|treating someone}], and {it hasn't slipped once|the standard has held} in all that time.[ {obj3} {joined|got added to} the {list|rotation} {recently|last month}.][ {What keeps me coming back|The reason I keep coming back} is {partly|mostly} {attr1}, but also {that|the fact that} {the staff|the team} {remember|actually remember} {regulars|people} and {never|don't} rush anyone.][ They've been {reliable|consistent} with {svc1} every time.][ {aside}][ They {know|really know} their {range1}.][ {If you're|For anyone} {looking for|after} {geo1}, {this is|it's} {the place I'd send you|where I'd start}.]" },
  { size: "long", text: "First {visit|time} at {store} and {I'm|we're} {converted|impressed}. {I'd|We'd} {come for|planned on} {obj1}[ and {the person at the counter|the staff} {suggested|pointed me to} {obj2} {as well|to go with it}, which {turned out to be|was} the right call][; {obj3} {went home with us|came home with us} too]. {Everything|All of it} {came out|was ready} {quickly|fast}, {nothing|none of it} {felt|seemed} {rushed|thrown together}, and {the staff|the team} {kept up|stayed cheerful} even {with a queue|when it got busy}.[ {aside}][ {attr1} {stood out|was obvious} {straight away|from the start}.][ {attr2} {backed it up|matched it}.] {Prices|The prices} {are|were} {fair|reasonable} for what you get, and {I'll|we'll} be back {soon|before long}." },
  { size: "long", flavors: ["doughnut", "bakery", "coffee"], text: "{Needed|Was after} something {for the office|for a birthday|for a friend} and {a colleague|a friend} {suggested|recommended} {store}. {Went with|Ordered} {obj1}[ and {obj2}] and {they|the shop} {packed|boxed} it {properly|carefully} {without me asking|on the spot}. {It|Everything} {arrived|was} {fresh|exactly as described}, looked {the part|as good as it should}, and {was gone|disappeared} {within the hour|before I'd finished my coffee}.[ They kept {svc1} {smooth|painless} too.][ {aside}][ {attr1} didn't hurt either.] {Everyone|People} asked where it was from, {which is the point|which says it all}, and I've {since|already} been back {for myself|on my own account}." },
  { size: "long", text: "{Glad|Happy} to have this kind of {cat} in {loc}; {store} {fills|filled} a gap. {I had|We had} {obj1}[ and {obj2}] and {it all|everything} {held up|delivered}[, with {obj3} {as the surprise|the surprise of the day}].[ {attr1} {stood out|is the standout}; {you can tell|it's clear} {someone|the team} {takes it seriously|cares about the details}.][ {attr2} {came close|isn't far behind}.][ {aside}] {Service|The service} {kept up|kept pace} {on a busy morning|even with a queue}, {nobody|no one} {rushed us|hurried us}, and {the prices|prices} were {fair|reasonable}. {I've|We've} {already|since} {told|sent} {friends|two friends} {about it|here}." },
  { size: "long", text: "{I'd|We'd} {been looking for|searched around for} {geo1} for {a while|months} and {store} {ended the search|is where it ended}. {Went with|Tried} {obj1}[ and {obj2}][, plus {obj3} {to take home|for later}], and {everything|all of it} was {fresh|properly fresh} and {done right|exactly as it should be}.[ {aside}][ {attr1} {stood out|was the detail I noticed}.][ {attr2} {backed it up|matched it}.] {The staff|The team} were {relaxed|friendly} and {quick|on it}, {the place|it} was {busy|full} but {comfortable|not loud}, and {the prices|prices} were {fair|sensible} for {what we had|what you get}. {It's|This is} an easy {recommendation|place to recommend}." },
  { size: "long", text: "{store} came recommended by {a colleague|a neighbour|a friend} and it {held up|lived up to it}. I went in {for|after} {obj1}[, came out with {obj2} as well][ and {obj3} for later], and {the whole thing|the visit} took {about twenty minutes|less than half an hour} {without feeling rushed|and never felt rushed}.[ {What I noticed|What struck me} was {attr1}; {you don't get that everywhere|that's not a given}.][ {attr2} {stood out|held up} too.][ {aside}] {Prices|The prices} were {clear|fair}, {the staff|the team} {were|stayed} {cheerful|friendly} {through a queue|even when it got busy}, and {I've|we've} {already|since} been back.[ For {geo1}, {this is my answer|I'd start here}.]" },
  { size: "long", text: "What sets {store} apart is {attr1}[, with {attr2} {close behind|right behind it}]. {I|We} {came in|turned up} {on a packed Saturday|at the busiest time of the morning} and {still|even then} {got served within minutes|never waited long}[; {obj1} {came out|arrived} {fast|quickly} and {did not disappoint|held up}][, and {obj2} {went down|got finished} {just as fast|equally fast}].[ {aside}][ They {handled|took care of} {svc1} {smoothly|as promised}.] {Prices|The prices} {are|were} {fair|reasonable}, the staff {kept|held} their good mood {through the rush|even at full tilt}, and {I|we} {left|walked out} {already planning the next visit|talking about coming back}." },
];

export const STORY_FRAMES: Record<StoryFamily, readonly StoryFrame[]> = {
  retail: RETAIL,
  restaurant: RESTAURANT,
  cafe: CAFE,
};

// ------------------------------------------------------------ assembly ----

export type StoryInput = {
  family: StoryFamily;
  flavor: StoryFlavor;
  size: StorySize;
  store: string;
  /** Entity terms; frames using them are offered only when `allowPlace`. */
  cat: string | null;
  loc: string | null;
  allowPlace: boolean;
  /** Already RENDERED strings (article applied by the engine), in weave order. */
  objs: readonly string[];
  ranges: readonly string[];
  attrs: readonly string[];
  preds: readonly string[];
  svcs: readonly string[];
  geos: readonly string[];
  rng: () => number;
};

export type StoryResult = {
  text: string;
  size: StorySize;
  frameIndex: number;
};

type Kind = "objs" | "ranges" | "attrs" | "preds" | "svcs" | "geos";
const KINDS: readonly Kind[] = ["objs", "ranges", "attrs", "preds", "svcs", "geos"];
const KIND_OF: Record<string, Kind> = { obj: "objs", range: "ranges", attr: "attrs", pred: "preds", svc: "svcs", geo: "geos" };
const SLOT_RE = /\{(obj|range|attr|pred|svc|geo)([1-3])\}/g;

type Segment = { text: string; optional: boolean };

/** Split a frame into top-level optional/mandatory segments. No nesting. */
function segmentsOf(text: string): Segment[] {
  const out: Segment[] = [];
  let buf = "";
  let optional = false;
  for (const ch of text) {
    if (ch === "[" && !optional) {
      if (buf) out.push({ text: buf, optional: false });
      buf = "";
      optional = true;
    } else if (ch === "]" && optional) {
      out.push({ text: buf, optional: true });
      buf = "";
      optional = false;
    } else {
      buf += ch;
    }
  }
  if (buf) out.push({ text: buf, optional });
  return out;
}

type Need = Record<Kind, number> & { place: boolean; aside: boolean };

function needsOf(text: string): Need {
  const need: Need = { objs: 0, ranges: 0, attrs: 0, preds: 0, svcs: 0, geos: 0, place: false, aside: false };
  for (const m of text.matchAll(SLOT_RE)) {
    const kind = KIND_OF[m[1]!]!;
    need[kind] = Math.max(need[kind], Number(m[2]));
  }
  if (/\{cat\}|\{loc\}/.test(text)) need.place = true;
  if (/\{aside\}/.test(text)) need.aside = true;
  return need;
}

function expandChoices(tpl: string, rng: () => number): string {
  return tpl.replace(/\{([^{}]*\|[^{}]*)\}/g, (_m, body: string) => {
    const opts = body.split("|");
    return opts[Math.floor(rng() * opts.length)]!;
  });
}

function pick<T>(arr: readonly T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)]!;
}

/** Whitespace and punctuation seams left by dropped segments. */
function tidy(text: string): string {
  return text
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/([,;:])\s*(?=[,.;:!?])/g, "")
    .replace(/,\s*,/g, ",")
    .replace(/\s{2,}/g, " ")
    .replace(/([.!?])(?=[A-Z])/g, "$1 ")
    .trim();
}

const SIZE_FALLBACK: Record<StorySize, StorySize[]> = {
  short: ["short", "medium", "long"],
  medium: ["medium", "long", "short"],
  long: ["long", "medium", "short"],
};

/** Share of drafts that carry a flavour aside when one is available. */
const ASIDE_CHANCE = 0.6;

/**
 * Pick a frame that absorbs (nearly) the most of what the guest tapped, at the
 * requested length, and fill it. Returns null when no frame fits (the engine
 * then falls back to the slot assembly).
 */
export function buildStory(input: StoryInput): StoryResult | null {
  const frames = STORY_FRAMES[input.family];
  const avail: Record<Kind, number> = {
    objs: input.objs.length,
    ranges: input.ranges.length,
    attrs: input.attrs.length,
    preds: input.preds.length,
    svcs: input.svcs.length,
    geos: input.geos.length,
  };
  const placeOk = input.allowPlace && !!input.cat && !!input.loc;
  const asides = STORY_ASIDES[input.flavor];

  type Cand = { index: number; absorbed: number };
  const candidatesFor = (size: StorySize): Cand[] => {
    const out: Cand[] = [];
    frames.forEach((frame, index) => {
      if (frame.size !== size) return;
      if (frame.flavors && !frame.flavors.includes(input.flavor)) return;
      const segs = segmentsOf(frame.text);
      const mandatory = needsOf(segs.filter((s) => !s.optional).map((s) => s.text).join(" "));
      const total = needsOf(frame.text);
      if (mandatory.place && !placeOk) return;
      for (const k of KINDS) if (mandatory[k] > avail[k]) return;
      let absorbed = 0;
      for (const k of KINDS) absorbed += Math.min(avail[k], total[k]);
      out.push({ index, absorbed });
    });
    return out;
  };

  let pool: Cand[] = [];
  let size: StorySize = input.size;
  for (const s of SIZE_FALLBACK[input.size]) {
    pool = candidatesFor(s);
    if (pool.length > 0) {
      size = s;
      break;
    }
  }
  if (pool.length === 0) return null;

  // One phrase of slack: the page must not lean on the single frame that
  // happens to hold every slot, and one phrase can still go out through a
  // tail without the draft reading as a stack.
  const best = Math.max(...pool.map((c) => c.absorbed));
  const top = pool.filter((c) => c.absorbed >= best - 1);
  const chosen = pick(top, input.rng);
  const frame = frames[chosen.index]!;

  // Resolve inline choices first (they never contain a slot), then decide
  // each optional segment, then fill.
  const expanded = expandChoices(frame.text, input.rng);
  const aside =
    asides.length > 0 && input.rng() < ASIDE_CHANCE ? expandChoices(pick(asides, input.rng), input.rng) : "";

  const segs = segmentsOf(expanded);
  const kept: string[] = [];
  for (const seg of segs) {
    if (seg.optional) {
      const n = needsOf(seg.text);
      const slotsInside = KINDS.some((k) => n[k] > 0) || n.place || n.aside;
      if (slotsInside) {
        let ok = true;
        for (const k of KINDS) if (n[k] > avail[k]) ok = false;
        if (n.place && !placeOk) ok = false;
        if (n.aside && !aside) ok = false;
        if (!ok) continue;
      } else if (input.rng() < 0.5) {
        continue;
      }
    }
    kept.push(seg.text);
  }

  let text = kept.join("");
  text = text.replace(SLOT_RE, (_m, kindKey: string, idx: string) => {
    const kind = KIND_OF[kindKey]!;
    return input[kind][Number(idx) - 1] ?? "";
  });
  text = text
    .replace(/\{store\}/g, input.store)
    .replace(/\{cat\}/g, input.cat ?? "")
    .replace(/\{loc\}/g, input.loc ?? "")
    .replace(/\{aside\}/g, aside);
  text = tidy(text);

  return { text, size, frameIndex: chosen.index };
}
