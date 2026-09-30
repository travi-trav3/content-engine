# Club Pilot humor

**Required reading before writing any Humor-pillar concept.**

Version 2, Aug 12 2026. Version 1 was written the same day and was too narrow: it took one joke that worked, the snowstorm card, and turned its sentence structure into the only permitted form. That is the opposite error from the one it was fixing, and it would have produced a year of identical cards. This version keeps the one thing that is non-negotiable, which is that a joke needs a mechanism, and opens up everything else.

---

## 1. The only rule that never moves

**A joke needs a reason to be funny, and you have to be able to say what it is in one sentence.**

That is the whole requirement. Not a structure, not a sentence shape, not a template. If you can name why it lands, you can write it any way you like. If you cannot, no amount of rewriting the punchline will save it, because the punchline was never the problem.

The post pulled on Aug 12 failed this test and nothing else. *"What time does the pool close?" (Asked from the pool.)* Standing at the pool does not tell you when it closes, so there was no reason for anyone to laugh. It matched the approved example's shape perfectly, which is exactly how it got through.

---

## 2. Mechanisms that work here

These are starting points, not a menu to pick from and stop. If you find a new one that works, use it and write it down.

**Observable contradiction.** The evidence is right there and answers the question. *"Is the course open?" (It is currently snowing.)* When you use this one, the thing the asker can see has to genuinely settle it. Falling snow settles whether the course is open. Standing at the pool settles nothing.

**Recognition.** Nobody is wrong and nothing is contradicted. The laugh is "that is my club." *Every club has the member who reads the entire newsletter and the member who has never opened one.* This is the warmest mechanism and usually the most forwardable, because the operator sees their own room in it.

**Devotion taken slightly too far.** The member is not foolish, they are committed past the point of reason. Playing until they physically cannot see the ball. Walking in at 5:55 for a 6:00 tee time in February. Affection, not mockery.

**Understatement.** Describe genuine operational chaos completely flatly. *Three inches of rain, a burst pipe, and a wedding. Tuesday.* The gap between the size of the event and the flatness of the telling does the work.

**Scale.** The true number, stated plainly, that is absurd once you see it. *The dress code was explained forty-one times in June.* Only use a number you actually have or can honestly frame as typical.

**Deadpan juxtaposition.** Two true things side by side, no commentary, no punchline. The reader closes the gap themselves. This one is very strong on a photo.

**Self-deprecation.** Club Pilot or the club is the butt. Always available, never risky, and underused.

---

## 3. The three hard limits

These are brand safety, not comedy theory. They do not flex.

**Never blame a member for not checking a channel.** "It was on the website." "It was in the March email." "If they had opened the app." Every one of these argues that the club's communication was fine and the member is the failure. Club Pilot's entire position is the reverse: the information existed and could not be reached. This sells against the product, and it is what killed the pool card as much as the missing mechanism did.

**Never make the member's intelligence the joke.** The reader is a GM or comms manager who likes their members and is protective of them. Devotion, habit, enthusiasm, forgetfulness, all fair. Stupidity, never. They will not forward a card that laughs at their own membership in public.

**It has to land without a footnote.** Cover any explanatory line at the bottom and read it again. If the joke stops working, the footer was carrying it and there was no joke on the card.

---

## 4. Format is wide open

**The pillar is a subject, not a layout.** Humor is not "the type card with a quote in it." That was one execution of it, and running it every time makes the feed predictable.

Humor can be:

- a photograph with one flat line over it
- a message thread, as long as it obeys `capability-boundary.md`
- a big number
- a carousel that builds to something
- a list
- a type card, still, when the line genuinely deserves the silence

The photo formats are the most underused and often the funniest, because the image can carry the whole setup and leave the line to do almost nothing. A silhouette of someone still swinging in near darkness needs about six words.

See `brand/format-rotation.md` for how formats cycle across pillars. Humor is not exempt from it in either direction: Humor should not always be a type card, and the type card should not always be Humor.

---

## 5. Ledger fields the gate enforces

| Field | Type | Rule |
|---|---|---|
| `humorMechanism` | string | Required when `pillar` is Humor. One sentence naming why it is funny. Free text, so a new mechanism is allowed, but it has to be a reason and not a restatement of the joke |
| `observableAnswer` | string | Required **only** when `humorMechanism` is observable contradiction. Names the thing the asker can see that settles the question |
| `standsWithoutFooter` | boolean | Required when `pillar` is Humor. Must be true |
| `approvedBy` | string | Required when `pillar` is Humor, unless the post goes to Buffer as a draft that Byron reads and schedules himself (`review: "buffer-drafts"`, 2026-09-30). Either way, nothing publishes before a person has read the line and said yes |

Enforced by `editorial-gate.js`, which also hard-fails member-blaming copy anywhere in the batch, on any pillar, and refuses any Humor post without `approvedBy`. Humor is review-first: see `editorial-standard.md` section 3 for why.

The gate does not judge whether a joke is funny and it cannot. It refuses to let a concept through until someone has said out loud why it should work. That is a low bar on purpose. The pool card could not clear it.
