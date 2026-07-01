/**
 * Extra guest-facing phrase pools (no SEO jargon, no typographic long dashes).
 * Combined with `review-full-templates.ts` base pools for strong combinatorial variance.
 * Large inventory additions: `review-phrase-pools-bulk.ts`.
 */

import {
  PHRASE_BRIDGES_LONG_BULK,
  PHRASE_BRIDGES_SHORT_BULK,
  PHRASE_CLOSERS_LONG_BULK,
  PHRASE_CLOSERS_SHORT_BULK,
  PHRASE_CORE_BULK,
  PHRASE_FILLERS_BULK,
  PHRASE_OPENERS_LONG_BULK,
  PHRASE_OPENERS_SHORT_BULK,
} from "@/lib/review-phrase-pools-bulk";

export type OpenerFn = (store: string) => string;
export type CoreFn = (store: string, list: string) => string;
export type BridgeFn = (store: string) => string;

export const PHRASE_OPENERS_LONG_EXTRA: readonly OpenerFn[] = [
  (s) =>
    `Tried ${s} on a whim and ended up talking about the meal longer than the movie we saw after.`,
  (s) =>
    `Our group at ${s} runs hot and cold on new spots; this time we mostly agreed it was a win.`,
  (s) =>
    `I don't love writing reviews, but ${s} gave me a few specifics worth typing out.`,
  (s) =>
    `Went to ${s} after a long week. The kind of reset I actually notice the next day.`,
  (s) =>
    `${s} felt lived-in, not showroom perfect, and the food backed that up.`,
  (s) =>
    `If you're comparing options nearby, ${s} should be on the short list based on our visit.`,
  (s) =>
    `Date night at ${s} didn't feel like a gamble, which is rarer than it should be.`,
  (s) =>
    `Lunch at ${s} turned into a longer sit than planned, and I didn't mind.`,
  (s) =>
    `Walked into ${s} hungry and skeptical, walked out mellow and pretty impressed.`,
  (s) =>
    `${s} isn't trying to dazzle with gimmicks; the strengths are quieter than that.`,
  (s) =>
    `Caught ${s} on an off-night for weather, vibes were still steady inside.`,
  (s) =>
    `Kid at our table was picky; even they found something they'd eat again at ${s}.`,
  (s) =>
    `Older relatives joined us at ${s}. Nobody struggled to hear or follow the pacing.`,
  (s) =>
    `Coffee after dessert at ${s} wasn't an afterthought, which I appreciated.`,
  (s) =>
    `Portions at ${s} matched the menu photos more honestly than usual.`,
  (s) =>
    `I'd put ${s} in the \"reliable recommendation\" bucket after one visit.`,
  (s) =>
    `${s} handles the boring stuff well too: napkins, water, clearing plates without drama.`,
  (s) =>
    `We showed up fifteen minutes early; ${s} seated us without making it weird.`,
  (s) =>
    `Allergies got taken seriously at ${s}, not brushed off as an annoyance.`,
  (s) =>
    `Crowd at ${s} felt like locals plus a few travelers, which I like.`,
  (s) =>
    `Music level at ${s} let us talk without leaning in like we're at a club.`,
  (s) =>
    `${s} is the spot I'd pick if I'm tired and don't want to \"perform\" for staff.`,
  (s) =>
    `Parking stress was minimal around ${s}, small thing but it sets the tone.`,
  (s) =>
    `${s} left us full, not painfully stuffed, which is harder to calibrate than it looks.`,
  (s) =>
    `Took photos for the group chat; captions wrote themselves because ${s} had clear highs.`,
  ...PHRASE_OPENERS_LONG_BULK,
];

export const PHRASE_OPENERS_SHORT_EXTRA: readonly OpenerFn[] = [
  (s) => `Notes from ${s}, while I still remember the plates.`,
  (s) => `${s} worked for us. Here's the quick version.`,
  (s) => `Solid meal at ${s}; a few callouts below.`,
  (s) => `${s} gets a honest thumbs up from our table.`,
  (s) => `We'd repeat ${s} without much debate.`,
  (s) => `${s} felt easy, start to finish.`,
  (s) => `Not every place earns a paragraph. ${s} did.`,
  (s) => `Quick shout for ${s} after a good night.`,
  (s) => `${s}: better than our average weekend pick.`,
  (s) => `Clean experience at ${s}, food included.`,
  (s) => `${s} hit the spot when we were hungry and picky.`,
  (s) => `I'd send a friend to ${s} with normal expectations.`,
  (s) => `${s} didn't waste our evening; that matters.`,
  (s) => `Random pick that paid off: ${s}.`,
  (s) => `${s} was worth the short wait we had.`,
  ...PHRASE_OPENERS_SHORT_BULK,
];

export const PHRASE_CORE_EXTRA: readonly CoreFn[] = [
  (s, list) =>
    `Where ${s} really earned it for me was ${list}, not generic hype.`,
  (_, list) =>
    `The honest highlight reel is ${list}, full stop.`,
  (s, list) =>
    `If I narrow it down, ${list} is what I'd tell people about ${s}.`,
  (_, list) =>
    `You can feel the intent behind ${list}; it's not accidental.`,
  (s, list) =>
    `${s} threaded ${list} through the meal without making it feel forced.`,
  (_, list) =>
    `The stuff that actually mattered: ${list}.`,
  (s, list) =>
    `Our table kept circling back to ${list} when we talked about ${s}.`,
  (_, list) =>
    `I'd be annoyed if I missed ${list} on a first visit here.`,
  (s, list) =>
    `${list} is the reason ${s} stands out in a crowded category.`,
  (_, list) =>
    `Call it old school, but ${list} still wins when it's done right.`,
  (s, list) =>
    `${s} made ${list} taste like a decision, not a checkbox.`,
  (_, list) =>
    `No weird flex, just ${list} showing up consistently.`,
  (s, list) =>
    `Between apps and mains, ${list} is what I still picture from ${s}.`,
  (_, list) =>
    `Texture, timing, and ${list} lined up better than I expected.`,
  (s, list) =>
    `If ${s} has a signature move, it might be ${list}.`,
  (_, list) =>
    `I came for the photos, stayed for ${list}.`,
  (s, list) =>
    `${list} read as fresh at ${s}, not tired repeats.`,
  (_, list) =>
    `This is the part friends ask about: ${list}.`,
  (s, list) =>
    `${s} didn't bury ${list} under sauce or noise.`,
  (_, list) =>
    `Simple pitch: ${list}, executed.`,
  (s, list) =>
    `Crowd-pleasers usually bore me; ${list} didn't at ${s}.`,
  (_, list) =>
    `I'd reorder around ${list} on a return visit.`,
  (s, list) =>
    `${list} made ${s} feel worth leaving the neighborhood for.`,
  (_, list) =>
    `The meal had edges, sure, but ${list} was the clean win.`,
  ...PHRASE_CORE_BULK,
];

export const PHRASE_BRIDGES_LONG_EXTRA: readonly BridgeFn[] = [
  (s) =>
    `Orders landed in a sane order so we weren't staring at cold food at ${s}.`,
  (s) =>
    `Wine and water touches were attentive without theatrics at ${s}.`,
  (s) =>
    `Allergen questions got clear answers before we ordered at ${s}.`,
  (s) =>
    `Menus were readable without a flashlight, which shouldn't be noteworthy, yet here we are.`,
  (s) =>
    `Kid chairs and spacing were handled without slowing the night down at ${s}.`,
  (s) =>
    `Lighting at ${s} was warm enough that photos looked human, not clinical.`,
  (s) =>
    `Check arrived when we signaled, not while we were still chewing at ${s}.`,
  (s) =>
    `Greeter and server were coordinated; we weren't ping-ponged at ${s}.`,
  (s) =>
    `Restrooms were clean enough that I'd mention them, oddly enough.`,
  (s) =>
    `They offered a takeaway box without acting like we're cheap at ${s}.`,
  ...PHRASE_BRIDGES_LONG_BULK,
];

export const PHRASE_BRIDGES_SHORT_EXTRA: readonly BridgeFn[] = [
  (s) => `Details were tight at ${s}.`,
  (s) => `Flow felt natural at ${s}.`,
  (s) => `${s} kept the room under control.`,
  (s) => `No weird lulls at ${s}.`,
  (s) => `Staff at ${s} read busy vs chill correctly.`,
  (s) => `Tables felt spaced fairly at ${s}.`,
  (s) => `${s} didn't rush the tab.`,
  (s) => `Small asks got quick nods at ${s}.`,
  ...PHRASE_BRIDGES_SHORT_BULK,
];

export const PHRASE_CLOSERS_LONG_EXTRA: readonly OpenerFn[] = [
  (s) =>
    `If our night is any guide, ${s} is doing the work that actually shows up in a review.`,
  (s) =>
    `I'd line up ${s} against pricier places we tried last month and feel fine about it.`,
  (s) =>
    `Not promising perfection, but ${s} delivered enough that I'd bet on a second visit.`,
  (s) =>
    `For the category and the night we had, ${s} felt fairly priced and fairly run.`,
  (s) =>
    `I'll remember ${s} as a place that respected our time and our taste buds.`,
  (s) =>
    `When friends ask for a rec in this area, ${s} is now in my mental file.`,
  (s) =>
    `We left ${s} without that sour \"should've stayed home\" feeling.`,
  (s) =>
    `Happy to be a repeat customer if ${s} stays this consistent.`,
  ...PHRASE_CLOSERS_LONG_BULK,
];

export const PHRASE_CLOSERS_SHORT_EXTRA: readonly OpenerFn[] = [
  (s) => `${s} is a yes from this table.`,
  (s) => `Go try ${s} with normal hopes; ours were met.`,
  (s) => `${s} worked. That's the tweet.`,
  (s) => `Simple rec: ${s}.`,
  (s) => `${s} earned the stars we gave.`,
  (s) => `We'd book ${s} again.`,
  (s) => `${s} made the outing feel worth it.`,
  (s) => `No regrets choosing ${s}.`,
  (s) => `${s} gets my nod.`,
  ...PHRASE_CLOSERS_SHORT_BULK,
];

export const PHRASE_FILLERS_EXTRA: readonly OpenerFn[] = [
  (s) =>
    `That rhythm matters more than novelty, and ${s} had it on our visit.`,
  (s) =>
    `I'm picky about repeats; ${s} cleared the bar easily enough.`,
  (s) =>
    `Consistency is boring until you miss it elsewhere, ${s} had plenty.`,
  (s) =>
    `Crowds sometimes ruin kitchens; didn't feel true for ${s} that night.`,
  (s) =>
    `Prices matched the plate, rare enough that I noticed at ${s}.`,
  (s) =>
    `If ${s} has an off night, ours wasn't it.`,
  (s) =>
    `Comfort food energy without feeling lazy sums up part of ${s} for me.`,
  ...PHRASE_FILLERS_BULK,
];
