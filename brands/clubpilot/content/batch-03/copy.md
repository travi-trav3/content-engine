# Club Pilot — Social batch 03 — copy + first comments

Window Aug 13 to Aug 31 2026. Gated by `capability-gate.js`, `editorial-gate.js` and `rotation-gate.js`
before scheduling. Passing all three means nothing known-broken is present. It is not a verdict on quality.

Already queued and untouched: the Aug 14 LinkedIn founder post and the Aug 18 Instagram ask.

The Humor pillar is out of this batch. Two Humor posts published and were deleted, Aug 15 and Aug 16.
Humor is review-first now: no concept renders until a person has read the line.

---

## 1 — linkedin_page · Intelligent communication · thread · 2026-08-13T08:10:00-07:00

**Template:** `b3-escalation-li`

**Earns its place:** Reproduces Club Pilot's own escalation script verbatim, including the 'Escalate to human' status marker from the product. No competitor can show this thread because it is our product behaving.

**On-image:** It does not guess. It gets a person. / The handoff is the feature, not the fallback.
**Thread:**
- member: Is the locker room renovation finished?
- assistant: I don't have that one. Want me to send it to the team?
- member: Yes please
- assistant: Sent. Someone will get back to you shortly.

**Caption**

Most demos show the assistant answering everything. The more useful moment is the one where it does not.

When a member asks something the club has not published, the assistant says so, offers to route the question to staff, and marks the thread for a human. A person picks it up from there and answers in their own voice.

An assistant that admits the edge of what it knows is the one an operator can put in front of members.

**First comment**

This is the part operators ask about first, usually phrased as a worry: what happens when it does not know? It says it does not know. That is the whole answer, and it is the reason the rest of it gets trusted.

**Alt:** Dark card with a phone thread. A member asks whether the locker room renovation is finished. The assistant replies that it does not have that one and offers to send the question to the team, then confirms it was sent.
**Capability:** depictsAssistant=True · escalation · endsAtHandoff
**Buffer:** `6a7c06ebb9bf3c9a99f6af7f` scheduled, first comment set

---

## 2 — instagram · Member experience, elevated · photo · 2026-08-13T19:05:00-07:00

**Template:** `b3-dawn-ig`

**Earns its place:** The claim is specific to how our assistant works: it answers from a document the club uploaded, at an hour nobody is staffing. A generic SMS tool cannot make the from-your-own-hours claim.

**On-image:** She asked at 6:12am. The club answered at 6:12am. / The hours were already posted. Reaching them at 6am is the new part.

**Caption**

Early risers do not wait for the pro shop to open to find out when the pro shop opens.

The hours were already written down. What changed is that a member can reach them at six in the morning, over text, without waiting for someone to unlock a door.

That is the whole trick. Not a smarter club. A reachable one.

**First comment**

The unglamorous truth about member experience: most of it is information the club already has, arriving at the moment a member actually needs it.

**Alt:** Early morning light through cypress trees on an empty golf course; headline She asked at 6:12am. The club answered at 6:12am.
**Capability:** depictsAssistant=True · answer · source: facility hours sheet
**Buffer:** `6a7c06f88fc995b827b09965` scheduled, first comment set
**Revision:** v1 subhead read 'Straight from the hours the club already published.' Operator flagged it as unclear: it stated the source-document rule instead of saying what changed for the member. Rewritten and reshipped as v2 under a new filename, per the CLAUDE.md rule that raw.githubusercontent keeps serving stale bytes for an overwritten path.

---

## 4 — instagram · Operator POV, day in the life · list · 2026-08-17T07:40:00-07:00

**Template:** `b3-list-ig`

**Earns its place:** Names the five club document classes our assistant is actually trained on. It is the front-desk-leak thesis stated as an inventory, which is our argument, not a general one.

**On-image:** Five things your club already wrote down. / All five get asked again this week.
**On-image body:** The dress code. The guest policy. Holiday hours. Aeration dates. Junior access.

**Caption**

Your club has already answered these. They live in a policy PDF, a board letter, a seasonal notice, and somewhere in last spring's email.

Members are not going to dig for any of it. So the questions come back to the same two people at the front desk, every week, all season.

The work is not writing the answers. It is making them reachable.

**First comment**

Worth an audit at your own club: pick the five questions your team answers most, then find where each answer already exists in writing. The overlap is usually total.

**Alt:** Dark card with a numbered list of five club documents: the dress code, the guest policy, holiday hours, aeration dates, junior access. Headline Five things your club already wrote down.
**Capability:** depictsAssistant=False
**Buffer:** `6a7c0fb432a67c68e33fa3fa` scheduled, first comment set

---

## 5 — linkedin_page · The front desk leak · data · 2026-08-19T09:20:00-07:00

**Template:** `b3-math-li`

**Earns its place:** Puts a number on the labour cost of repeated questions, which is the specific problem we sell against and the one Byron built the company around.

**On-image:** Two minutes each. Four hundred a week. / THE MATH NOBODY RUNS
**On-image body:** Thirteen hours of someone's week, spent saying things the club has already written down.

**Caption**

Time one of the routine questions your front desk answers. It runs about two minutes start to finish, including the pause while someone looks it up.

Now count them. Most clubs land north of four hundred a week in season. That is roughly thirteen hours, most of a role, spent repeating what the club already published.

This is not a staffing problem and the fix is not a bigger desk. It is making the written answers reachable without a person in the middle.

**First comment**

The number that lands hardest is usually not the hours. It is what the team would rather be doing with them, which is almost always the members standing in front of them.

**Alt:** Dark card, headline Two minutes each. Four hundred a week, with the line about thirteen hours spent repeating what the club already published.
**Capability:** depictsAssistant=False
**Buffer:** `6a7c0fc81b970aa73b3ba656` scheduled, first comment set

---

## 6 — instagram · Intelligent communication · list · 2026-08-20T18:35:00-07:00

**Template:** `b3-docs-list-ig`

**Earns its place:** Maps each member question to the club document that answers it. That mapping IS the product mechanism, and it is the thing capability-boundary.md exists to protect.

**On-image:** Three questions. Three documents.
**On-image body:** "How many guests can I bring Saturday?" Guest policy. "Is the pool open on the 4th?" Holiday hours. "When do the greens get punched?" Seasonal notice.

**Caption**

Three questions your club has already answered, in writing, somewhere.

The guest policy covers Saturday guests. The holiday schedule covers the 4th. The seasonal notice covers aeration. All three were written weeks or months before anyone asked.

The assistant answers from those documents, in the club's own wording, at whatever hour the question arrives. The work was never writing the answers. It was making them reachable.

**First comment**

Which is also why the setup work matters. What the club uploads is what the assistant can answer. Clubs that put real documents in get real answers out.

**Alt:** Dark card mapping three member questions to the club document that answers each one: guest policy, holiday hours, seasonal notice. Headline Three questions. Three documents.
**Capability:** depictsAssistant=True · answer · source: guest policy, holiday hours, seasonal operations notice
**Buffer:** `6a7c0fd2c3d422e62bd8ffe8` scheduled, first comment set
**Rotation:** Re-cut from thread to list on 2026-08-12. Intelligent communication already runs a thread on Aug 13, and rotation-gate.js hard-fails a pillar using the same format twice in one batch.

---

## 7 — instagram · Member experience, elevated · thread · 2026-08-22T11:50:00-07:00

**Template:** `b3-tomorrow-thread-ig`

**Earns its place:** Shows the assistant answering from conditions the club posted that afternoon, in the club's own wording. The source-document framing is ours.

**On-image:** Asked in the parking lot. Answered in the parking lot.
**Thread:**
- member: Are we cart path only tomorrow?
- assistant: Cart path only until noon, then open. Posted this afternoon.

**Caption**

Nobody wants to end a good round standing at a counter, waiting to find out whether tomorrow is cart path only.

The conditions were posted that afternoon. The member just needed a way to reach them without a phone call, at the exact moment they were thinking about it.

Elevated is not a bigger gesture. It is a shorter distance between the question and the answer.

**First comment**

Retention rarely turns on one grand moment. It turns on a hundred small ones where the club was easy to deal with. This is one of them.

**Alt:** Phone thread on a dark card. A member asks whether the course is cart path only tomorrow and the assistant answers from the conditions posted that afternoon.
**Capability:** depictsAssistant=True · answer · source: published course conditions
**Buffer:** `6a7c0fdb62c0df440d7f2387` scheduled, first comment set
**Rotation:** Re-cut from photo to thread on 2026-08-12. Member experience had run as a photograph in every batch to date, which rotation-gate.js flags as a stuck pillar. Frees david-goldsbury.jpg for the Humor post.

---

## 8 — linkedin_page · Operator POV, day in the life · portrait · 2026-08-24T08:05:00-07:00

**Template:** `b3-founder-li`

**Earns its place:** Byron's own account of resisting, then shipping, the handoff. Nobody else has this story and nobody else can tell it.

**On-image:** The feature I was most nervous about shipping. / It was the assistant saying I do not have that.
**On-image body:** It was the assistant saying I do not have that. Admitting a gap felt like admitting the product was thin. I had it backwards. Operators do not fear an assistant that does not know something. They fear one that invents something in front of a member. The moment we showed the handoff instead of hiding it, the room relaxed.

**Caption**

I pushed back on it internally. Admitting a gap felt like admitting the product was thin.

I had it backwards. Operators do not fear an assistant that does not know something. They fear one that invents something in front of a member. The moment we showed the handoff instead of hiding it, the room relaxed.

Saying I do not have that, and routing the question to a person, turned out to be the most persuasive thing the product does.

Cheers, Byron White, Founder, Club Pilot

**First comment**

If you are building anything with AI in it for a conservative industry, my one lesson is this: trust comes from the edges you draw, not the capability you claim.

**Alt:** Byron White headshot on a dark card; headline The feature I was most nervous about shipping.
**Capability:** depictsAssistant=False
**Buffer:** `6a7c0fe532a67c68e33fa6b8` scheduled, first comment set
**Note:** Byron first-person on the LinkedIn COMPANY page, same pattern as the Aug 14 post. His personal profile is API-locked in Buffer, so the company page is the only option. Flagged for the operator: first-person founder copy on a company page is a known open item, not a new one.

---

## 9 — instagram · Proof and results · data · 2026-08-25T12:15:00-07:00

**Template:** `b3-stat-ig`

**Earns its place:** Uses the benchmark to argue our one-system position, that each channel carries the traffic it is good at, rather than arguing text beats email. The conclusion on the card is Club Pilot's category framing from BRAND.md.

**On-image:** A text gets answered in about ninety seconds. An email takes about ninety minutes. / THE PROOF
**On-image body:** 90 seconds to answer the average text. 90 minutes to answer the average email. So the closure goes by text. The newsletter still goes by email. Source: industry benchmark.

**Caption**

Two numbers worth sitting with. The average text gets a reply in roughly ninety seconds. The average email takes roughly ninety minutes.

That is not an argument against email. Club event emails still open well, and the newsletter belongs there.

It is an argument for sending each thing down the channel it is actually good at. The course closure goes by text because it is worthless in an hour. That routing is the whole job.

**First comment**

Both figures are industry benchmarks, not Club Pilot results, and we keep them attributed that way on purpose. The point is about routing, not about us.

**Alt:** Dark card contrasting two figures, 90 seconds for a text reply against 90 minutes for an email reply, closing with the line So the closure goes by text, the newsletter still goes by email. Attributed to an industry benchmark.
**Capability:** depictsAssistant=False
**Buffer:** `6a7c0ff4c3d422e62bd9024f` scheduled, first comment set
**Revision:** v1 put a bare industry benchmark on the card with the line 'Same question, different channel.' Any SMS vendor could have posted it verbatim, so it failed the earns-its-place bar even though it passed every gate. v2 puts our one-system conclusion on the card itself: the closure goes by text, the newsletter still goes by email. Caught while writing the earnsItsPlace sentence, which is what the field is for.
**Note:** Stat pair taken from BRAND.md section 8, the ~90-second text response versus ~90-minute email response. Attributed on-image as an industry benchmark, never as a Club Pilot or client outcome, and never fused with the separate 98 percent open-rate and 3-minute read stats.

---

## 10 — instagram · Industry pulse · photo · 2026-08-27T17:55:00-07:00

**Template:** `b3-pulse-ig`

**Earns its place:** Aeration is the club-operations question our assistant answers from a seasonal notice. The specificity to club ops and to a document class is ours.

**On-image:** The most predictable question of the year. / Answered from the notice you already sent.

**Caption**

Every club sends the aeration notice. Every club then answers the same question for six days straight.

The dates were in the notice. The notice was in an email in March. The member is standing on the course in August wondering what happened to the greens.

Seasonal operations are the easiest thing to get ahead of, because the answer is written long before the question arrives.

**First comment**

A good test for any seasonal notice: could a member find the answer six weeks later without searching their inbox? If not, the notice went out but the information did not land.

**Alt:** Putter and ball on a close-cut green at dusk; headline The most predictable question of the year.
**Capability:** depictsAssistant=True · answer · source: seasonal operations notice
**Buffer:** `6a7c0ffe32a67c68e33fa94a` scheduled, first comment set
**Photo:** Uses mick-de-paola.jpg. edwin-compton.jpg was rejected: the inherited Aug 18 ask post already runs it, and reusing it 9 days later on the same channel would read as a repeat.

---

## 11 — linkedin_page · Intelligent communication · compare · 2026-08-28T08:45:00-07:00

**Template:** `b3-compare-li`

**Earns its place:** States the category spine straight from BRAND.md, that competitors sell channels and clubs need an ecosystem. This is the position, not an observation.

**On-image:** A channel is not a system.
**On-image body:** Channels: text, email, app. Each one more place to check. One system: the right message, to the right member, through the channel they already answer.

**Caption**

Most clubs solve communication by adding another channel. Text was going to fix it. Then the app. Then a different email tool.

Every addition is another place for staff to check and another place for a member to miss something. Three channels with no system is not three times the reach. It is three times the surface area.

The goal was never more channels. It is every member getting the right information through the one they actually answer.

**First comment**

The tell that a club has channels and not a system: nobody can say with confidence which members saw the last important message.

**Alt:** Dark card split in two. On the left, three separate channels labeled text, email and app. On the right, one system routing to the channel a member answers.
**Capability:** depictsAssistant=False
**Buffer:** `6a7c100762c0df440d7f25de` scheduled, first comment set

---

## 12 — instagram · The ask · type-card · 2026-08-30T12:40:00-07:00

**Template:** `b3-ask-ig`

**Earns its place:** Points at our own walkthrough and describes what it shows, including the handoff to staff. Only we have that artefact.

**On-image:** Watch it answer a real member question. / No sales call required.
**On-image body:** CTA button: Watch the walkthrough. Eyebrow: See it in three minutes.

**Caption**

If you have read along this month and wondered what this actually looks like, the fastest answer is three minutes of watching it work.

The walkthrough shows a member question answered from club documents, a text campaign going out, and the handoff to staff when the assistant does not have something.

Watch the 3 minute walkthrough: clubpilot.com/interactive-demo

**First comment**

No login required to watch it. If your club runs on documents nobody can find, the second half is the part worth your attention.

**Alt:** Dark card, headline Watch it answer a real member question, with a Watch the walkthrough button.
**Capability:** depictsAssistant=False
**Buffer:** `6a7c102273b5399abc765d80` scheduled, first comment set

---

## Withdrawn

### b3-03-humor-ig — Humor — was 2026-08-15T10:25:00-07:00

**On-image:** "What time does the pool close?" / Asked at 9:58pm. From the pool.

**Withdrawn 2026-08-12 by Travis Enos.** deleted from Buffer by the operator after it published; template, render and hosted asset removed

**Why it failed.** The joke had no mechanism. Standing at the pool does not tell you when the pool closes, so the parenthetical named a location instead of supplying evidence, and there was no gap between what the member could see and what they asked. Three compounding faults: the 9:58pm timestamp made the member look considerate rather than oblivious; the card carried a footer explaining itself; and that footer blamed the member for not checking the website, which argues the club's communication was fine and sells against the product.

**Root cause.** Same failure mode as the Aug 6 capability incident. The Humor pillar documented a shape (type card, question, parenthetical) and an example, but never the mechanism that made the example work. The generator reproduced the shape. capability-gate.js passed it because nothing about it was a false product claim.

**Fix.** brand/humor-standard.md plus editorial-gate.js, which hard-fails this post on all three faults.

### b3-03-humor-dusk-ig — Humor — was 2026-08-16T18:40:00-07:00

**On-image:** Nobody is coming in until they cannot see the ball. / Every club has one. Most clubs have nine.

**Withdrawn 2026-08-17 by Travis Enos.** PUBLISHED to Instagram on 2026-08-16 and deleted from Instagram by the operator. Buffer shows it as sent, so it cannot be recalled there. Template, render and hosted asset removed.

**Why it failed.** Failed the editorial bar before it failed as a joke. Nothing in it touches member communication, the assistant, the front desk or anything Club Pilot does, so any golf account could have posted it word for word. Three further faults: the pun did not resolve, because a reader parses 'most clubs have nine' as a larger count of members before reaching the nine-holes reading; recognition without a sharp turn is just an observation, and 'some people play until dark' is flat; and a magazine-grade sunset signals reverence, so the reader is set up for something moving and gets a mild joke.

**Root cause.** Process, not craft. The Aug 15 Humor post had already been rejected. A second joke was written, rendered, hosted, scheduled and published without any human reading the line. Two rejections in a row is evidence that generated humor for this brand is not calibrated, and the right response to the first was to stop shipping the category unsupervised.

**Fix.** brand/editorial-standard.md, which adds the only-we-could-post-this bar on every pillar and puts Humor on review-first. editorial-gate.js hard-fails any Humor post without approvedBy, so this cannot be repeated by a future session.

Both Humor slots stay empty. Filling a slot is what produced the second failure.
