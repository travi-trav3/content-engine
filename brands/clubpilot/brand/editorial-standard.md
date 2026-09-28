# Club Pilot editorial standard

**Required reading before any concept, on any pillar.**

Version 1, Aug 17 2026. Written after two Humor posts published to the live Instagram account and were deleted by the operator, on Aug 15 and Aug 16. Neither was a compliance failure. Both passed every gate. Both were simply not good enough to have been published, and the second one shipped after the first had already been rejected.

---

## 1. The bar

**A post has to be one that only Club Pilot could publish.**

Read the finished post and ask whether a rival member-communication platform, a golf apparel brand, a course, or a beer company could put out the same thing word for word. If they could, it does not go out. It is not wrong, it is not risky, it is just filler wearing our logo, and filler is worse than an empty slot because it teaches the audience the feed is skippable.

The Aug 16 post failed this instantly. *"Nobody is coming in until they cannot see the ball."* over a sunset. Nothing in it touches member communication, the assistant, the front desk, or anything Club Pilot does or believes. Any golf account on earth could have posted it. It was a nice photograph with a caption.

**Never ship a post to fill a slot.** The calendar is a plan, not a quota. If the good version does not exist yet, the slot stays empty and the cadence takes the hit. An empty Sunday costs nothing. A weak Sunday costs the next twenty posts a little bit of attention.

---

## 2. What went wrong twice, in order

**Aug 15, the pool card.** *"What time does the pool close?" (Asked from the pool.)* No mechanism. Standing at the pool does not tell you when it closes, so there was no gap and no joke. Diagnosed in `humor-standard.md`.

**Aug 16, the sunset card.** *"Nobody is coming in until they cannot see the ball."* Four faults:

1. **Nothing to do with Club Pilot.** Fails the bar in section 1 outright.
2. **The pun does not resolve.** "Every club has one. Most clubs have nine." The reader parses "nine" as a bigger count of members before they get anywhere near the nine-holes reading, and by then the joke is over. A pun that needs a second pass is not a pun.
3. **Recognition without a turn is just an observation.** "Some people play until dark" is true and flat. Recognition only lands when the articulation is sharper than how the reader would have said it themselves. This was not.
4. **The photograph fought the intent.** A magazine-grade sunset silhouette signals reverence. The reader is set up for something moving and gets a mild joke, which reads as a misfire even if the line were good.

---

## 3. The process failure underneath both

The first joke was rejected. I then wrote a second joke, rendered it, hosted it, scheduled it, and let it publish, without a human ever reading the line. That is the actual defect. Two rejections in a row is not a run of bad luck, it is evidence that generated humor for this brand is not calibrated, and the correct response to a rejection is to stop shipping that category unsupervised rather than to try again harder.

**Humor is now review-first.** No Humor post gets rendered, scheduled or published until Travis has read the line as plain text and said yes. Concepts cost nothing to review as three lines in a message. Renders and published posts cost real attention and real cleanup.

This restriction lifts when three consecutive Humor concepts are approved without a rewrite.

---

## 4. What the gates can and cannot do

`capability-gate.js`, `editorial-gate.js` and `rotation-gate.js` catch specific, known, previously observed failures: false product claims, unapproved club marks, jokes with no stated mechanism, copy that blames a member, a pillar stuck in one format.

**They do not and cannot certify that a post is good.** Every gate is satisfiable by an author who is wrong. The Aug 16 post passed all three. Its `humorMechanism` field said "recognition and devotion," which is a real mechanism, honestly named, on a post that was not funny.

Never read "all gates passed" as "ready to publish." It means nothing known-broken is present. The judgment is still a judgment, and for anything where the judgment has recently been wrong, the judgment belongs to a person.

---

## 5. Ledger field

| Field | Type | Rule |
|---|---|---|
| `earnsItsPlace` | string | Required on every post, every pillar. One sentence naming what makes this a post only Club Pilot could publish. "It is on brand" and "it fits the pillar" are not answers. Name the product truth, the operator problem, or the position it carries |

Enforced by `editorial-gate.js`. Like every other required field in this pipeline, the gate cannot check whether the sentence is true. It can only make you write it, which is usually enough to notice when there is nothing to write.
