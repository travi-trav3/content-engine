# Batch plan template

**No plan, no batch.** A batch cannot be generated without `content/batch-NN/plan.json` passing
`plan-gate.js`. The plan is where Travis is in the loop, once per batch, before anything is written.
It is the step that prevents both the Aug 6 overreach and the batch 3 monoculture: the engine
generates against an approved list of messages instead of filling slots with the safest thing that
passes the fences.

Validate:

```bash
node plan-gate.js content/batch-NN/plan.json \
     content/batch-01/ledger.json content/batch-02/ledger.json content/batch-03/ledger.json
```

After generation, the ledger must match the plan:

```bash
node plan-gate.js --match content/batch-NN/plan.json content/batch-NN/ledger.json
```

## Plan file shape

```json
{
  "batch": "club-pilot-batch-NN",
  "window": "YYYY-MM-DD to YYYY-MM-DD",
  "posts": [ { ...one entry per post, fields below... } ]
}
```

## Per-post fields

| Field | Rule |
|---|---|
| `id` | Stable post id, `bNN-XX-slug`. The ledger entry carries the same id |
| `date` | `YYYY-MM-DD` |
| `channel` | `instagram`, `linkedin_page`, or `linkedin_byron` |
| `pillar` | One of the seven, exact string: The front desk leak; Member experience, elevated; Intelligent communication; Proof and results; Operator POV, day in the life; Humor; Industry pulse |
| `territory` | The second axis, what posture the post takes: `seeing`, `thinking`, `learning`, `building`, `promote`. A post is one pillar and one territory |
| `audience` | `champion` or `buyer`, never "clubs" |
| `feeling` | One word: `seen`, `safe`, `relieved`, `capable`, `hopeful` |
| `aversion` | One of: `more systems`, `more work`, `more risk` |
| `message` | One sentence, the single thing this post says, stated plainly, with no metaphor and no abstraction. If it cannot be stated in plain language it is not a message, it is a phrase. Must be distinct from every other message in the plan and from the last 30 days of ledger messages |
| `depictsAssistant` | boolean. If true: `interactionType` (`answer` or `escalation`), and `sourceDocument` (answers) or `endsAtHandoff: true` (escalations), per the capability boundary |
| `depictsScenario` | boolean. Does the post depict a club scenario? |
| `operationalCheck` | Required when `depictsScenario` is true. The operational fact the scenario relies on, plus its source. Reference an entry id from `brand/club-operations-facts.md` |
| `surface` | `dark-type`, `photo-full-bleed`, or `thread`. No surface above one third of the batch, no two adjacent the same per channel. Surface is the coarse visual shell; the ledger's `format` field (photo, thread, type-card, data, portrait, list, compare, per `brand/format-rotation.md`) is the finer taxonomy the rotation gate reads. dark-type covers type-card, data, list and compare; photo-full-bleed covers photo and portrait; thread is thread |
| `artDirectionMatch` | Required on `photo-full-bleed`. One sentence confirming the described shot depicts the scenario in the copy |
| `founderVoice` | boolean, default false. True only for first-person Byron posts, which run only on `linkedin_byron` |
| `ctaType` | `none` (default), `demo`, `app`, `follow`, `website`. At most one non-`none` per batch |
| `approvedBy` | Travis's name and a date. Empty fails |

## Batch rules the validator enforces

- LinkedIn carries at least half the slots, and all founder and front desk slots.
- The "already written down" idea, or any post whose message is about answers coming from documents,
  is capped at one per batch (enforced through the diversity gate's theme cap).
- Messages are deduplicated against the plan itself and the last 30 days of ledgers.
- At most one post carries a CTA (the 10% promote band).
- No surface above one third of the batch; no two adjacent posts on a channel share a surface.
- Any reference to the retired old-way-vs-intelligent-way structure fails.
- Territory mix per batch holds to 50 (seeing) / 25 (thinking) / 15 (learning + building) /
  10 (promote), rounded to whole posts, plus or minus one post per band. The validator reports the
  actual distribution either way.
- Every plan entry carries the eight-point approval checklist (see below); all eight true, except
  `worksWithoutCta` may be false on the single promote post. Every false carries a `rationale`.

## The approval checklist (per post)

Byron's seven-point approval test plus one addition, as booleans on each plan entry:

| Field | Question |
|---|---|
| `interestingWithoutPurchase` | Would a smart club GM find this interesting even if they never buy Club Pilot? |
| `peerToPeer` | Does it sound like one industry professional talking to another? |
| `credibleScenario` | Is the scenario credible and respectful of how clubs operate? |
| `oneThought` | Does the graphic communicate one thought in about three seconds? |
| `captionAddsLayer` | Does the caption add insight rather than repeat the graphic? |
| `worksWithoutCta` | Can the post work without a CTA? |
| `buildsTrust` | Does the post build trust, curiosity or conversation? |
| `hasDistribution` | Does this post have a path to an audience? A post can pass the other seven and reach forty people |
