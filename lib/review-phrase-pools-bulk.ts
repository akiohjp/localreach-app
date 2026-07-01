/**
 * Bulk guest-facing phrase inventory (offline templates). Grow this file to reduce collisions.
 * Rules: no em/en dash as sentence glue; avoid essay-outline parallelism; skip SEO jargon.
 */

type OpenerFn = (store: string) => string;
type CoreFn = (store: string, list: string) => string;
type BridgeFn = (store: string) => string;

export const PHRASE_OPENERS_LONG_BULK: readonly OpenerFn[] = [
  (s) =>
    `${s} was on our maybe list forever; glad we stopped scrolling and ate.`,
  (s) =>
    `Coworkers and I grabbed ${s}; nobody fake-smiled through bad food.`,
  (s) =>
    `${s} turned a sleepy Tuesday closer to Saturday without trying too hard.`,
  (s) =>
    `Walk from host stand to seat told me plenty, ${s} kept going from there.`,
  (s) =>
    `Split everything at ${s} on purpose because we're annoying about fairness.`,
  (s) =>
    `${s} smelled like real cooking walking in, not just candles masking oil.`,
  (s) =>
    `Menu sounded simple at ${s}. Simple is brutal to execute and they landed it.`,
  (s) =>
    `Nobody at ${s} pushed nonsense upsells while we stared at hunger.`,
  (s) =>
    `Ran into someone leaving ${s}; they leaned in whispering yeah, go.`,
  (s) =>
    `${s} was packed but nobody felt glued to strangers' elbows.`,
  (s) =>
    `Thought we'd eat quick at ${s}. Talked ourselves into dessert instead.`,
  (s) =>
    `First bites at ${s} pulled my skepticism downward in a hurry.`,
  (s) =>
    `${s} did the boring groundwork before flashy flourishes, I noticed that.`,
  (s) =>
    `Debated leftovers on the sidewalk after ${s}, food worth arguing over.`,
  (s) =>
    `Comfortable seating at ${s} saved my back without me thinking about lumbar marketing.`,
  (s) =>
    `${s} tasted like someone tasted the sauces before plating, dusty detail.`,
  (s) =>
    `Host clocked our lost faces at ${s} and pointed us politely without sighing.`,
  (s) =>
    `${s} had chatter without drowning out whoever sat across.`,
  (s) =>
    `Kid colored quietly at ${s}; not the headline but it eased the booth.`,
  (s) =>
    `If Sundays at ${s} feel normal, Tuesdays must be dangerously gentle.`,
  (s) =>
    `Salt hangover skipped me heading home from ${s}, appreciate that.`,
  (s) =>
    `${s} didn't hand us laminated novels disguised as menus.`,
  (s) =>
    `Wine steer at ${s} matched vibe and receipt without TED talk.`,
  (s) =>
    `Tea tasted clean afterward at ${s}, no bitter sucker punch.`,
  (s) =>
    `${s} slid napkins toward us before we ruined sleeves.`,
  (s) =>
    `Extras landed with spare forks without us begging at ${s}.`,
  (s) =>
    `We lingered past prime exit time at ${s} and nobody side-eyed us.`,
  (s) =>
    `${s} cooks like diners actually chew, weird compliment, meant kindly.`,
  (s) =>
    `Bread could've been shrug emoji at ${s}; they clearly cared.`,
  (s) =>
    `Textures matched what the menu hinted at ${s}, edges crisp where promised.`,
];

export const PHRASE_OPENERS_SHORT_BULK: readonly OpenerFn[] = [
  (s) => `${s}? Chatter was right.`,
  (s) => `${s}: glad we dragged ourselves over.`,
  (s) => `Calm-ish night food-wise at ${s}.`,
  (s) => `${s} beat our sleepy benchmark.`,
  (s) => `${s}: casual thumbs up here.`,
  (s) => `${s} was the uncomplicated win.`,
  (s) => `Can't argue anyone toward ${s} tonight.`,
  (s) => `${s} felt steady, not flashy.`,
  (s) => `Smooth enough visit to ${s}.`,
  (s) => `${s}: small wait, fine payoff.`,
  (s) => `Good gamble picking ${s}.`,
  (s) => `${s}, mellow afterward.`,
  (s) => `Honest like for ${s}.`,
  (s) => `${s} earns a stray bookmark.`,
];

export const PHRASE_CORE_BULK: readonly CoreFn[] = [
  (_, list) => `Real talk ${list}.`,
  (s, list) => `${list} anchored my night there at ${s}.`,
  (_, list) => `Memory lane says ${list}.`,
  (s, list) => `${s} took ${list} seriously without yelling about it.`,
  (_, list) => `Straight answer: ${list}.`,
  (s, list) => `Plate after plate, ${list} stayed believable at ${s}.`,
  (_, list) => `${list}: no smoke, mirrors.`,
  (s, list) => `${list} looked honest coming out at ${s}.`,
  (_, list) => `I'd chirp ${list} to a neighbor.`,
  (s, list) => `${list} glued apps to mains at ${s} without gimmicks.`,
  (_, list) => `I'd trade flashy trends for ${list} this dialed.`,
  (s, list) => `${s} kept ${list} loud enough on the palate.`,
  (_, list) => `Skip drama, ${list} mattered.`,
  (s, list) => `${list} skipped side commentary yet still read clear at ${s}.`,
  (_, list) => `Salt/acid leaned right around ${list}.`,
  (s, list) => `${list} tasted like testers actually ate some at ${s}.`,
  (_, list) => `Fork wandered back toward ${list} more than elsewhere.`,
  (s, list) => `${list} earned the calorie spend at ${s}.`,
  (_, list) => `Picky eater at booth nodded at ${list}.`,
  (s, list) => `${list} freshened midway without tasting like soap at ${s}.`,
  (_, list) => `${list} temps weren't guesswork.`,
  (s, list) => `${s} squeezed real flavor around ${list} without tricks.`,
  (_, list) => `Seasoning nudged ${list} upward, didn't smother.`,
  (s, list) => `${list} lined up okay with sticker shock at ${s}.`,
  (_, list) => `Share bites around ${list} vanished quick.`,
  (s, list) => `${list} smelled like it would taste before fork hit at ${s}.`,
];

export const PHRASE_BRIDGES_LONG_BULK: readonly BridgeFn[] = [
  (s) =>
    `${s} smelled clean without smelling like disinfectant perfume.`,
  (s) =>
    `Kitchen noise hovered friendly at ${s}, not nightclub bleed.`,
  (s) =>
    `Heat from spices piled slow at ${s}, never throat-punch.`,
  (s) =>
    `Coffee and plates showed up genuinely hot at ${s}, mundane win.`,
  (s) =>
    `${s} halved receipts without melodrama.`,
  (s) =>
    `High chairs didn't wobble at ${s}; parents clock that.`,
];

export const PHRASE_BRIDGES_SHORT_BULK: readonly BridgeFn[] = [
  (s) => `Door flow felt human at ${s}.`,
  (s) => `${s}: pace felt adult.`,
  (s) => `Service matched chewing speed at ${s}.`,
  (s) => `Host podium wasn't riot at ${s}.`,
  (s) => `${s} kept rims clean.`,
  (s) => `${s}: calm under swirl.`,
  (s) => `Nobody orbit-stared our table at ${s}.`,
];

export const PHRASE_CLOSERS_LONG_BULK: readonly OpenerFn[] = [
  (s) =>
    `${s} lands in my \"might detour slightly\" pile without regrets.`,
  (s) =>
    `Crowds drift seasonally everywhere; tonight ${s} bought patience.`,
  (s) =>
    `Probably raises bar for whatever you eat afterward, beware ${s}.`,
  (s) =>
    `Measuring lunches this week against ${s}, unfair fight.`,
  (s) =>
    `Future ${s} nights might differ but this one's filed under win.`,
];

export const PHRASE_CLOSERS_SHORT_BULK: readonly OpenerFn[] = [
  (s) => `${s} stays pinned.`,
  (s) => `Try ${s} once.`,
  (s) => `${s}? sure.`,
  (s) => `Team ${s} tonight.`,
  (s) => `${s}: good enough repeat.`,
  (s) => `Go back ${s}? yeah.`,
  (s) => `${s}: worked out.`,
];

export const PHRASE_FILLERS_BULK: readonly OpenerFn[] = [
  (s) =>
    `${s} left a texture memory oddly strong next morning.`,
  (s) =>
    `Hungry-needs matched plate sizes at ${s}.`,
  (s) =>
    `Sugar behaved around mains at ${s}.`,
  (s) =>
    `Prep felt tight even when ${s} got slammed.`,
  (s) =>
    `Forgot phones looking for leftovers after ${s}.`,
];
