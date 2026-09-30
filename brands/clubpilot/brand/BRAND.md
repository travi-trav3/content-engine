# Club Pilot — Brand + Strategy Source of Truth

> This is the authoritative brand bible for the Club Pilot social-content pipeline.
> Compiled by the operator (Travis) on 2026-07-23 from the Club Pilot project locked
> state, voice files, emotional core, the Notion content-pillar strategy, and a live
> extraction from clubpilot.com. Everything here is sourced. `[GAP]`, `[GATED]`, and
> `[CONFIRM]` markers are open items — never fill them with guesses.

## LIVE RULE OVERRIDES (operator instructions given in-session — these win)

- **Club Pilot 2.0 is live (2026-09-30, Byron via Travis).** Content is written as if Email, Text,
  Mobile App and AI Assist are all live, in one platform with one inbox and one member history. The
  engine launches only once they are. This supersedes the Aug 26 rule that kept the unified hub in
  the "what we're building" territory. What each channel does, and what AI Assist still never does,
  is in `capability-boundary.md` section 0.
- **Calls to action (2026-09-30).** The ask is to book time with the team: a live demo, a call, a
  complimentary 20-minute review of how it would work at the reader's club. It reads as a casual
  meet-the-team session, never a sales call. About one post in four asks, never two in a row on a
  channel, and the line rotates through the library in `config.json` (`cta.variants`). The engine adds
  the ask as the caption's last line; generated copy never writes its own.
- **"Book" is the reader's word, never the assistant's (2026-09-30).** A call to action may say book.
  A post that depicts the assistant may not: it never books tee times, courts or dinner reservations,
  and never implies it. Naming the tee sheet is fine ("Rip out the tee sheet? No."); saying Club Pilot
  connects to, syncs with or reads from it is not.
- **Byron's personal LinkedIn (2026-09-30)** is being connected to the new Buffer account. Founder posts
  are first person and come only from material Byron supplies (source mode); each is approved by him
  before it publishes.

- **Em dashes: BANNED.** No em dashes anywhere — headlines, body, chat bubbles, UI
  mockups. (Confirmed by operator in chat 2026-07-23; also matches §3 of this doc.)
- **"Trusted By" club logos: APPROVED for social (2026-07-24).** Byron's written approval
  landed. Proof-ladder rung 3 is now UNLOCKED. Use the approved-for-social set only:
  Salem Country Club, Sleepy Hollow, St. Andrews CC Boca Raton, Worcester, Lost City Golf
  Club, Willowbend, Breakers West, Essex County Club (+ the monogram marks) in
  assets/img/clublogos/. Rules still bind: on-canvas + caption language stays at "Trusted by"
  level only — roster membership, NO result claims, NO "clubs love us", NO implied quotes or
  endorsements. Headdress mark runs in ORGANIC placements only, never paid/boosted. These real
  clubs still may NEVER appear as senders in demo message threads.
  **Named testimonials remain GATED** — no approved quotes yet; do not write or imply any.
- **Headline casing: SENTENCE CASE.** (Operator's final call 2026-07-23. After discussion,
  sentence case for all graphic headlines and subheads, matching the design system's own
  documented rule (project CLAUDE.md / readme) and every authored template. The earlier
  "title case" instruction is retired. Eyebrows, button labels, and stat labels stay
  UPPERCASE (tracked); running body and chat-bubble copy stay sentence case. If the operator
  later asks for title case, apply it to GENERATED copy regardless of template sample text.)
- **No single-word lines (HARD guardrail).** No headline or subheadline line in ANY graphic
  may carry just one word, ever — not an orphan at the end, not a stranded word mid-wrap
  (e.g. "She texted the club at 9pm." must never wrap so "9pm." sits alone). Size the type
  or hand-set the line breaks so every line carries 2+ words. Only exception: a deliberately
  clever single word set alone for emphasis as an intentional design choice. When generating
  copy, control every line break explicitly and verify in the rendered PNG.
- **Imported templates may be stale.** Some templates pulled from the Claude Design project
  do not reflect the operator's latest in-tool edits (confirmed on member-moment-ig, where a
  saved fix to the "9pm." line break did not come through). Treat imported template sample
  copy as a starting point, not ground truth; re-derive copy + line breaks per the rules here
  and re-verify in the render.

---

## 0. Read this first — five things that will embarrass the brand if the pipeline gets them wrong

1. **Testimonials are gated. The one on the live site is not cleared for social.** clubpilot.com currently shows a named quote ("Mike Dolan, Director of Member Services, Lost City Club"). Internally, **no named testimonial has been approved in writing yet.** The proof ladder is explicit: named testimonials unlock only from a supplied list with name, title, and club signed off in writing. Treat every named testimonial, including the one on the site, as `[GATED]` until Travis confirms written approval. Never paraphrase or invent one.

2. **The club names on the website are not the approved-for-social list.** The site displays logos for Pine Brook Country Club, Mosswood Meadows, Eugene Country Club, Grayson Valley Country Club, Shenorock Shore Club, and Lost City Club. The internally **approved "Trusted By" set for social** is a different list (Salem Country Club, Sleepy Hollow, St. Andrews CC Boca Raton, Worcester, Lost City Golf Club, Willowbend, Breakers West, Essex County Club, plus monogram marks) and even that is still pending Byron's one-email written memorialization. Only use real club logos/names from the written-approved set, and note that Byron's confirming email is still outstanding `[GATED]`. Any fictional demo-club name used as a message-thread sender must not resemble any real club.

3. **Lead with "intelligence," not "AI."** The live site still leads with "AI Powered Text Messaging" and "Let AI handle the routine." That is the old positioning. The **locked internal rule** is: "intelligence" is the headline word; "AI" appears only in feature-level detail. Follow the internal rule, not the current site copy. **Amended 2026-08-26:** "AI Assist" as a product name is permitted anywhere, including headlines, because Trinity names it as one of four visible product pillars. The rule against leading with "AI" as a generic claim or capability boast stands, and "Intelligent communication" stays banned as caption copy because it is pillar vocabulary. Awaiting Byron's confirmation on this distinction (open questions list).

4. **Never fuse the two SMS stats.** ~98% open rate and "up to 90% read within 3 minutes" are two separate industry-benchmark stats. "98% opened within 3 minutes" does not exist in any source and must never be written. Always attribute both as industry benchmarks, never as a Club Pilot or client outcome, never with an "@clubpilot" tag.

5. **The assistant is never the sender and Aimi is peripheral.** In any message-thread visual, the sender is a rotating fictional demo club, never "Aimi," never "ClubPilot," never a character avatar. Brand comes from a small "powered by Club Pilot" microline near the thread. "Aimi" appears only when going deep on that specific feature, never as a headline.

---

## 1. Product truth

**What it is, in plain terms.** Club Pilot is a member-communication platform for private clubs, country clubs, yacht clubs, and luxury resorts. It is the communication layer that sits on top of the operations software a club already runs (tee sheets, accounting, reservations, member portal, existing app), unifying email, text/SMS, the member app, and an intelligent assistant so members get instant answers through the channel they prefer and staff stop answering the same questions by phone.

**The one sentence never to get wrong:** Club Pilot is *not* club-management, tee-sheet, or operations software, and it does *not* replace what the club already uses. It is the communication layer that sits on top of all of them and consolidates member communication. (Getting this wrong turns the product into "one more platform," which is the single most common objection.)

**Who it's for.**
- Primary buyer: the **General Manager** (sometimes owner or board). Holds budget, needs board/owner defensibility.
- Primary champion: the **communications manager**, then membership director, then marketing director. Communication is their job; they feel the pain first and sell it internally.
- Secondary/incidental: director of golf and head pro (they surface in "day in the life" content but are not the primary target — a corrected assumption; do not center them).
- The **member** never buys but is the emotional proof in nearly every post.

**Core problem it solves.** Members expect instant, transactional ease everywhere else in life (banking, travel, reservations) and clubs are the holdout. Staff lose hours to repetitive member questions (a quantifiable labor cost plus the higher-value work they never get to), members ignore email blasts and push notifications, and there is no reliable way to get the right information to the right member through the channel they actually use.

**Top features / use-cases (described accurately):**
1. **Unified, multi-channel member communication** — email, text/SMS, and the member app in one place, so members hear from the club the way they prefer. Email is kept and unified, never replaced.
2. **The club's own named intelligent assistant** — instant, accurate, on-brand answers to routine member questions, around the clock, trained on the club's knowledge base. The club names its own assistant (default internal name "Aimi," kept peripheral). Framed as "intelligent member communication" / "the club's concierge," led by what it does.
3. **Text alerts, promotions, and surveys** with high open rates — reaching members where they answer instead of where they ignore.
4. **Question capture / trend insight** — the assistant captures member questions to surface trends and anticipate needs.
5. **Light implementation** — live in days, not a quarter-long IT project; sits on top of existing systems rather than ripping anything out.

**Pricing / plan basics.** Go-to-market motion is a **free 30-day trial → credit purchase → expansion** (more credits and features). The site has a `/pricing` page. Exact tiers, credit pricing, and dollar figures were **not captured** in this pass `[GAP — pull from /pricing or confirm with Byron before ever putting a price in a post]`. Pricing is generally not a social-post subject; the CTA is book-a-demo or free-trial, not a price.

**Activation event (internal, for measurement):** first SMS campaign sent or the club's assistant configured during the 30-day trial.

---

## 2. Positioning & messaging

**One-line value prop (north star):** *Members get instant answers, staff get their day back.*
**Emotional register of the same idea (use when writing, not explaining):** *Members answer. Staff stop chasing.*
**Secondary line:** RETIRED 2026-08-26. See the Retired lines section at the end of this file.

**The job of organic social (adopted 2026-08-26, from Byron's editorial brief):** organic social
builds trust with club general managers and industry professionals over many posts. It does not need
to explain the product, prove ROI, or drive a demo in any single post. Most posts carry no call to
action at all. In Byron's words: "Don't try to generate a lead from every post. Generate trust over
many posts." The audience is a peer, never a target: nothing may imply a GM's current communication
is foolish, outdated, behind, or broken.

**Dual-track positioning rule (adopted 2026-08-26, resolves wedge vs platform):** the sellable
product today is AI-powered text messaging; the position is centralized multi-channel communication.
Social content supports both realities. Any post that implies buy-now, trial, or current capability
describes what exists today. The coming platform (the Preference Center, the Centralized Inbox, the
unified hub) may be discussed only in the "what we're building" territory, framed as direction and
philosophy, never as available capability. `brand/capability-boundary.md` governs both tracks and
nothing in the Trinity positioning document loosens it.

**Channel-versus-channel language is retired (2026-08-26):** the company is becoming a multi-channel
platform. Content may never position one channel as the winner over another, and may never imply that
email, apps, push or text fail. The larger story is member choice and centralized communication.

**Category framing / the spine (the single most important strategic idea):** Competitors sell communication *channels*; clubs need a communication *ecosystem*. "Text messaging is a channel, but it doesn't really solve a communication problem. Adding an app doesn't either, and nor does blasting more emails. The goal is every member receiving the right information through a channel that they want."

**The most board-defensible line (verbatim, Byron):** "Operations software should run the club, but communications software should connect the club to its members." Analogy: clubs will dedicate a communication platform the same way businesses adopted HubSpot, MailChimp, and Salesforce. This reframes the buy as inevitable and familiar, not novel and risky.

**Messaging pillars (the things we plant, in priority order):**
1. **The front-desk leak.** (Angle amended 2026-08-26.) The subject is a solvable industry pattern,
   never an accusation about this reader's club. Permitted: "Every club seems to have one question
   the staff answers twenty times a week." Banned: "Your staff is losing hours," or any second-person
   framing that assigns the problem to the reader.
2. **Meet members where they already answer.** Push and email get ignored; intelligent two-way reaches members where they respond. No new app for members to download.
3. **Communication is a retention and revenue driver, not a soft nicety.**
4. **Consolidation, not replacement** (the objection-killer). Sits on top of the stack the club already runs; connects, does not add a silo.
5. **Light implementation.** Live in days, not a quarter-long IT project.

**Proof points / differentiators vs. alternatives:**
- Golf Digest recognition at the PGA Show 2026 (wording LOCKED — see the awards/press list in §8; not gated).
- ~3 to 400 conversations with club leaders (Byron's framing; the one content moat no competitor can copy).
- USGA data-integration partnership (daily handicap index updates into the app).
- 67% member text opt-in, including members over 60 (kills the "our members are old" objection).
- $100M+ annual industry cost of answering routine member phone calls (NGF).
- Differentiator vs. operations players: "we sit on top of the stack a club already runs; we are not another system to manage."

**Candidate positioning line, not yet cleared:** "Communication is hospitality." Strong and consistent with everything Byron believes, but he has not said it himself. `[GATED — do not publish until Byron adopts it.]`

**Premium words to use:** intelligence, communication ecosystem, member experience, instant answers, consolidate, connect, the channel they prefer, modern clubs, member-centric, elevate.
**Words that cheapen (avoid):** blast, tool, gadget, bot (when leading), cheap, deal, "AI-powered" as a headline.

---

## 3. Brand voice

**Tone in five adjectives:** premium, restrained, intelligence-first, founder-to-operator (peer, not vendor), honest/specific.

**The voice standard (adopted 2026-08-26, Byron's editorial brief, verbatim):** smart, not clever.
Friendly, not promotional. Curious, not preachy. Conversational, not corporate. Knowledgeable, not
presumptuous. Optimistic, not critical. Human, not AI-generated. Write like a member of the club
industry sharing something interesting with another member of the club industry. The target voice is
demonstrated in `brand/voice-reference-posts.md`. The three-second rule is about the thought, not the
value proposition: one short thought, question or observation per graphic, never a full sales
argument. A line that sounds composed but communicates nothing ("Elevated is not a bigger gesture,"
"That routing is the whole job") creates distance rather than trust and does not ship.

**Point of view:** Written founder-to-operator, peer-to-peer. Speak to "you" (the operator) and "your members." Company voice is "we" sparingly. Founder content on Byron's personal page is first-person "I."

**Casing:** **Sentence case for all headlines. Never Title Case.** (The product name "Club Pilot" is two words, capitalized. The site domain/wordmark renders as "ClubPilot" one word — in copy, prefer "Club Pilot.") **[SEE LIVE RULE OVERRIDES — operator said "title case always" in chat; conflict unresolved.]**

**Emoji policy:** No emoji in Club Pilot brand copy (premium B2B register). Emoji in Notion strategy docs is internal only. Do not put emoji in captions or on-image copy.

**Punctuation / formatting quirks:**
- **No em dashes anywhere**, including chat bubbles and UI mockups. Use periods, commas, or short sentences.
- No AI-pattern filler ("genuinely," "actually," "in today's fast-paced world").
- No parallel call-and-response sentence structures.
- No urgency language (this audience answers to boards; urgency reads as a red flag).
- Short declarative sentences and stacked fragments are on-voice (see Byron's email sequence style: "Event promotions. Notifications. Alerts. Reminders.").

**Example sentences that sound exactly right:**
- "Your team didn't take the job to answer 'what time does the pool open.'"
- "A member texts at 9pm. They get an answer in seconds. They renew in spring."
- "Operations software runs the club. Communications software connects the club to its members."
- "Nothing you built was a mistake."

**Known abstractions (hard fail, list grows with each new offender):** lines that sound composed and
communicate nothing create distance rather than trust (Byron, Aug 26). Shipped offenders, banned
verbatim and near-verbatim: "is not a bigger gesture", "is the whole job", "the surface area",
"the room relaxed", "that routing". String matching catches only repeats of these; the real defense
is the plan's plain-language `message` field, reviewed by a person before generation. If a headline
sounds good and you cannot state what it means in plain words, it is the same defect and it does
not ship.

**Sentences that sound wrong (never write these):**
- "Email is dead." / "Clubs are communicating like it's 2012." (Villainizes what clubs use.)
- "Our AI-powered platform revolutionizes club communication!" (AI-as-headline, hype, exclamation.)
- "Streamline your workflow and boost ROI." (Champion doesn't own a budget or a "workflow"; she has a pile.)

**"Never say" list:**
- Never attack email, member apps, existing software, or tradition.
- Never imply members are old, resistant, or behind; never imply the club is behind.
- Never position one channel as the winner over another or imply email, apps, push or text fail (2026-08-26; the coming platform carries all of them).
- Never assign the problem to the reader in the second person ("your staff is losing hours," "your club is behind," "you have no system"). The subject is a solvable industry pattern, not this reader's failure (2026-08-26).
- Never name a competitor in content (Clubessential, ForeTees, Clubster, Member Text, Pacesetter, Jonas, Club Caddie, foreUP). Position by category only.
- Never present the ~98% / 3-minute SMS stats as a Club Pilot or client outcome, never fuse them, never tag "@clubpilot" on a benchmark.
- Never use a real approved club as the sender in a fabricated message thread.
- Never write or invent a testimonial quote; none are cleared yet.
- Never lead with "Aimi" or "AI-powered."
- No urgency, no em dashes, no exclamation-driven hype.

**"Always say" / required treatments:**
- Lead with the operator's reality (their emails, their phone calls, their members), then the principle.
- "Sits on top / consolidates / connects" wherever the too-many-platforms reflex could surface.
- Email is respected and part of the mix.
- Industry stats always attributed as "industry benchmark" / "industry data."
- Editorial mix (amended 2026-08-26, from Byron's brief): 50% teach or observe, 25% start
  conversations, 15% what we're learning or building, 10% promote. At most one post per batch
  carries a CTA. The old four-give-one-ask ratio is superseded (see changelog).
- Sign founder/email copy as: **Cheers, Byron White, Founder, Club Pilot.** Internal docs sign as **Travis**.

**The disarm framework (run before writing any post):** (1) Who is this for — champion, buyer, or both, never "clubs." (2) What does it make them feel — one word (seen, safe, relieved, capable, hopeful). (3) Which aversion does it disarm — more systems, more work, or more risk. The through-line that disarms all three: *nothing you built was a mistake.*

---

## 4. Content pillars

Source: Notion "Club Pilot: Content Pillar Strategy" (approved-pending-Byron). **Five core pillars + two tertiary (humor, industry pulse).** Think of each as narrative angle × audience. Pillar tags on cards must use these exact names — invented tags (Relatable, Brand, Amenity & Lifestyle, "The ask", "The triad") are violations.

**The two-axis taxonomy (added 2026-08-26).** Byron's four editorial territories do not replace the
pillars; they are a different axis. A **pillar** answers what the post is about (subject, the seven
below). A **territory** answers what posture the post takes: `seeing` (observations about how club
communication is changing), `thinking` (respectful questions for club leaders; the objective is
conversation, not correction), `learning` (lessons from clubs, research, NGF data, building the
product), `building` (product philosophy, features, demos, behind the scenes; the smaller portion of
the feed), `promote` (releases, recognition, occasional direct CTAs). A post is one pillar and one
territory: "The front desk leak" in `thinking` is a question about routine questions; the same
pillar in `seeing` is an observation about them. The batch territory mix holds to 50 (seeing) /
25 (thinking) / 15 (learning + building) / 10 (promote), enforced by `plan-gate.js`. Territory
names, like pillar names, are planning vocabulary and never render on creative. Prior ledgers carry
a best-guess `territory` with `territoryBackfilled: true`.

**Higher priority:** "The front desk leak" and "Intelligent communication" carry demand (LinkedIn-weighted). "Proof and results" compounds trust with no ask. GM-value angles are the deal-unblockers, so weight buyer-facing value inside every pillar.

**Core pillar 1 — The front desk leak** *(GM + comms manager)*
For: turning a normalized daily annoyance into a quantified labor cost the GM can defend to ownership. Example concept: cost-tally carousel, "count the hours your front desk spends answering the same five questions, multiply by what you pay them." Line: "Your team didn't take the job to be a search engine." Formats: single 4:5, cost-tally carousel, stat card.

**Core pillar 2 — Member experience, elevated** *(GM for retention/revenue + comms manager who delivers it)*
For: leading with an elevated member moment, then tying it to retention, event attendance, and clubhouse/F&B spend. Example concept: "A member texts at 9pm about Saturday's tournament, gets an answer in seconds, shows up, renews." Formats: warm 4:5 moment, on-brand message thread, "what elevated looks like" carousel.

**Core pillar 3 — Intelligent communication** *(comms manager + GM)*
For: owning the word "intelligence" by *showing* the platform answer a real member moment, not describing features. Example concept: message-thread graphic, "Can I bring two guests Saturday?" answered in seconds, in the club's voice, from the rotating fictional demo club. Formats: message-thread graphic, 3-card carousel. **The old-way-vs-intelligent-way side-by-side is RETIRED (2026-08-26):** its whole structure is the reader-blaming, channel-losing treatment that the amended rules ban. Any plan or ledger entry referencing it fails the gate. If it ever returns, it returns as a "then and now, industry-wide" structure with no reader blamed and no channel losing, and that is a new brief.

**Core pillar 4 — Proof and results** *(all audiences, especially the skeptical GM)* — **no ask, pure trust.**
For: third-party credibility that compounds before any demo request. Example concept: press-logo bar ("As featured in Golf Digest"), single-stat card, Trusted By bar (gated), testimonial card (gated). Formats: press bar, testimonial card, stat card. Publishing follows the proof ladder in §8.

**Core pillar 5 — Operator POV, day in the life** *(rotates across comms manager, GM, membership/marketing director; lead with comms manager)*
For: mirroring the operator's exact day so they tag a peer who lives it too. Example concept: "A comms manager's Monday: three urgent member updates before 9am and no reliable way to reach everyone." Formats: vignette single, before/after carousel.

**Tertiary pillar 6 — Humor** *(comms manager + GM)*
For: human, forwardable, still premium. Example concept: "Member: 'Is the course open?' (It is currently snowing.)" Format: clean type-led single 4:5 on dark canvas, restrained green accents.
**Read `brand/humor-standard.md` before writing one.** The snowstorm example is not a template to imitate, it is a mechanism: the member asks a question that something in front of them has already answered, and the parenthetical supplies that evidence. Copying the shape without the mechanism produces a card that looks right and is not funny, which is exactly what happened on 2026-08-12 and got pulled. Never blame a member for not checking a website, an email, or an app; that argues the club's communication was fine and sells against the product. **Humor is review-first**: two posts published and were deleted on Aug 15 and Aug 16 2026, so no Humor concept renders or ships until a person has read the line. Enforced by `editorial-gate.js`.

**Tertiary pillar 7 — Industry pulse** *(all audiences, opportunistic only)*
For: positioning Club Pilot as in-the-room on shifts in club operations and member expectations. Example concept: a short, timely take when something genuinely changes. Formats: text-led single, quote-style card.

**Cross-pillar series/formats (run inside the pillars, not new pillars):**
- **"From 300 conversations with GMs"** — teach club management, not software; sourced from Byron's 3–400 leader conversations. LinkedIn-weighted; doubles as founder content.
- **"One stat, one post"** — every sourced stat becomes its own clean visual + one observation. Cheapest unit to produce.
- **"Micro-stories"** — real club moments in three sentences ("the golf shop that answered the same question fourteen times"). Named clubs and client-specific numbers still require sign-off.

**Off-strategy, never produce:** "death of member portals," "email is dead," "clubs communicate like it's 2012," or anything villainizing what clubs already use.

---

## 5. Platform strategy — Instagram & LinkedIn

LinkedIn and Instagram are **co-primary with distinct jobs.** Facebook is a near-free mirror of Instagram.

**LinkedIn (demand).** Audience: the buyer (GM) and champion, where Byron's ~14K dormant followers live and where the buyer actually decides. Goal: demand and credibility. Carries the demand pillars (front desk leak, intelligent communication, operator POV, founder). Tone: professional, more context and copy, longer openings that start with the operator's reality. Formats: single image, carousels, document posts. Links live in the post copy. Cadence target: Byron's personal page targets **3 to 5x/week** build-in-public (currently dormant, being reactivated); Club Pilot company page cadence follows the give-to-ask rotation `[exact company-page per-week number not fixed — CONFIRM]`.

**Instagram (brand).** Audience: broader club world, warmth and member experience. Goal: brand, humor, member-world warmth. Tone: punchy, premium, relatable, visual-first, short hook-first captions. Formats: single 4:5 (1080×1350) and carousels (1:1, 1080×1080, card one standalone-readable). Hashtag strategy: `[GAP — no hashtag set has been defined yet. Recommend a small, consistent premium/club-industry set; needs Travis sign-off before use. Do not auto-generate generic hashtag walls.]`

**Tone difference between the two:** Instagram is visual, punchy, relatable, shorter. LinkedIn holds more context and copy and opens operator-first. Same idea, re-cut per platform (the pillar playbooks in §4 give separate IG and LinkedIn copy for each pillar — use them).

**Format do's / don'ts (both platforms):**
- Do: one headline and one CTA maximum per image; keep text light; leave the bottom ~20% clear for platform UI.
- Do: IG single image 4:5 at 1080×1350; carousel 1:1 at 1080×1080.
- **Don't** put a painted/rendered CTA button on organic static posts. A painted button isn't clickable, makes the post read as an ad, and taxes reach. Only the single designated "ask" template carries one CTA + official app-store badges. Links go in the caption (LinkedIn: in post copy).
- Editorial mix (amended 2026-08-26): 50% teach or observe, 25% start conversations, 15% learning or building, 10% promote. At most one CTA post per batch. Proof/testimonials run as pure trust with no ask.
- Known gap, flagged not fixed: a static-only IG feed caps reach in a Reels-weighted 2026 feed. Video is out of scope (Marko's lane). Not the pipeline's problem to solve, but don't over-promise IG reach on statics alone.

---

## 6. Design system

Premium, dark B2B system. Distinct from Golf Pilot's playful consumer tone. Mandate: **codify the existing brand faithfully, do not redesign.** Hard rule: **two distinct blues and three distinct greens must not be collapsed.**

**Color palette (confirmed hex, from the locked design system):**
- `color.canvas` — **#030712** (dark navy/near-black; the dark brand surface for dark designs).
- `color.brand` (green 1 of 3) — **#04AE4D** (emerald; the brand green, not acid green).
- `color.cta` orange gradient — **#ED5901 → #B83C00** (primary CTA gradient).
- Azure gradient (blue 1 of 2, secondary CTA e.g. Log In) — **#009EE8 → #006FA7**.
- Slate messaging blue (blue 2 of 2, chat UI) — **#435267 family**.
- Greens 2 and 3 of 3: **`[GAP]` only #04AE4D is documented.** The "three greens" mandate is real but the other two hex values were never recorded. Pull them from the Figma brand file or by pixel-sampling the live site; do not invent them. (NOTE: the imported Claude Design token set defines `--cp-green-confirm #0acb40` and `--cp-acid #45ff16` — reconcile these against the Figma source before treating them as canonical.)
- Live-site note: the rendered page body background is a dark slate (`oklch(0.21 0.034 264.665)`, ≈ Tailwind slate-900) and headline text is white (#FFFFFF). Treat **#030712 as the authoritative design-system canvas token**; the live site's slate is close but not identical.

Token convention (use these exact names so downstream prompts resolve): `color.canvas, color.brand, color.accent, color.cta, color.text, color.semantic.*; type.display, type.heading, type.body, type.caption; space.*; radius.*; motif.*`.

**Typography (confirmed from live extraction):**
- Family, everything: **Montserrat.** The live site uses Montserrat exclusively across headline and body (full stack: `Montserrat, ui-sans-serif, system-ui, sans-serif`).
- Weights actually in use on-site: **400 (Regular)** dominant, **500 (Medium)**, **600 (SemiBold)**. No 700+ observed on the homepage — the system reads light/restrained. For headline emphasis, 500/600 is on-brand; confirm whether a heavier display weight is wanted `[CONFIRM]`.
- Where to get it: **Montserrat is a standard Google Font**, free, no special licensing. No custom/paid font files needed.
- Token mapping: map `type.display`/`type.heading` to Montserrat 600/500, `type.body`/`type.caption` to Montserrat 400. Exact per-level px scale is not documented `[GAP — derive a scale or confirm].`

**Logo:**
- Confirmed asset: on-dark wordmark SVG at **`https://www.clubpilot.com/_app/immutable/assets/wordmark-darkbg.ZeYeMyZy.svg`** (renders "ClubPilot," alt text "Club Pilot Logo"). This is a live, linkable SVG for on-dark use.
- A **"headdress" monogram mark** exists and is referenced for organic proof placements only (not paid/boosted). Monogram marks also referenced in the Trusted By set.
- On-light variant, clear-space, and minimum-size rules: `[GAP — not documented. Source the full lockup set from the granted Figma brand assets before finalizing any logo placement.]`

**Iconography / gradient / graphic conventions:**
- Two signature gradients: the orange CTA gradient (#ED5901→#B83C00) and the azure secondary gradient (#009EE8→#006FA7). Use gradients on CTAs/buttons, not as full backgrounds.
- Recurring look: dark canvas, restrained brand-green accents, premium and uncluttered. Message-thread graphics are a core motif (slate messaging blue #435267 family for chat UI).
- `space.*`, `radius.*`, and a defined icon set: `[GAP — token values not documented; the imported Claude Design tokens/spacing.css fills much of this — reconcile.]`

**Figma / brand-guide source:** Figma brand assets were granted but a shareable Figma file URL is not in the docs `[GAP — get the Figma link from Aaron/Byron].` The living brand system otherwise lives in Claude Design (the imported project) rather than a single PDF brand guide.

**Ad/post specs:** IG single image 4:5 @ 1080×1350; carousel 1:1 @ 1080×1080 (card one standalone-readable). Templates are built at a 1080×1350 master with a centered 1080×1080 safe zone and a platform switch (instagram/linkedin). Brand-ads page also holds 4:5 + 9:16 variants (paid motion, not yet running, needs Byron budget approval).

---

## 7. Imagery

**Photography standard (locked):**
- **No AI-generated photorealistic human faces presented as real people, ever.** Byron appears only as his real headshot.
- Human moments use environmental and over-the-shoulder framing (not fabricated faces).
- Real environment and texture photography, graded to sit on the dark canvas — one cohesive grade across the system.
- Every photo slot carries an art-direction note describing the ideal real shot (which doubles as the running shot list).
- Photo slots are typed by category: `course, clubhouse, front_desk, member_moment, pro_shop, device_ui`.

**Mood / subjects / do-don't:**
- Do: premium, warm, restrained; real course/clubhouse/front-desk/member-moment texture; graded dark.
- Don't: stocky bright consumer imagery, fabricated human faces, anything that reads Golf Pilot-playful.

**Real in-app screenshots / device frames.** The pipeline shows only real screens inside device frames and never fabricates UI. **Important nuance for Club Pilot:** the message-thread visuals are an intentional brand device, and per the locked sender rule they show a **rotating fictional demo club** as the sender with a "powered by Club Pilot" microline — these are *designed on-brand graphics*, not screenshots of a real club's live thread. If you need genuine product screenshots (assistant configuration, dashboard, member app), the source is the granted Figma assets / the product itself via Aaron `[GAP — no confirmed screenshot library location or file links in the docs; request real UI captures before framing any "real screen." Do not fabricate UI.]`

**Where the visual library lives:** Figma brand assets (granted) + the live site's own imagery + Byron's real headshot. A durable, higher-quality asset set (Byron founder photos, one art-directed partner-club shoot) is a pending Byron cost/access decision `[GATED]`.

---

## 8. Proof & social

**Testimonials — all `[GATED]`.** No named testimonial is approved in writing. Format is built but not unlocked. The live-site quote (Mike Dolan, Director of Member Services, Lost City Club) is **not confirmed cleared for social** — do not reuse it until Travis confirms written sign-off (name, title, club). Never paraphrase or invent.

**Stats you can cite** (all as **industry benchmarks**, never as a Club Pilot/client outcome, never fused, no "@clubpilot"):
- **~98% SMS open rate** (vs roughly 20–25% for standard email marketing).
- **Up to 90% of texts read within 3 minutes** (the best speed stat; stands alone).
- **~90-second average text response** and **~90-minute average email response.** Each survives as an individually attributed industry benchmark. **The contrast-pair treatment is RETIRED (2026-08-26):** never present the two against each other, and never set any channel against another (see the channel-versus-channel rule in §2). The superseded guidance is preserved in the changelog at the end of this file. Structured allowlist: `brand/approved-stats.json`, enforced by `stat-gate.js`.
- **67% member text opt-in, including members over 60** (Byron's published blog; usable without benchmark attribution; the single most underused asset — kills the "our members are old" objection).
- **$100M+ per year** industry spend answering routine member phone calls (attribute to **NGF**).
- Stat guardrails: never use channel stats to imply club emails fail (club event emails open at 50–70%); product-UI mockups show only plausible product-reported metrics, never benchmark stats dressed as live data.
- `[CONFIRM before publishing]`: "more than 75% of adults 65+ are active online" (source unconfirmed); ~8% average email open rate (in tension with the 50–70% club figure — do not use as a blanket "email fails" stat).

**Awards / press you can name:**
- **Golf Digest**, PGA Show 2026 recognition. **LOCKED — approved by Travis 2026-07-31. Not gated. Do not re-open this.**
  - **Use this quote verbatim, everywhere:** `The coolest stuff we saw at the 2026 PGA Merchandise Show.`
  - **Attribution line:** `Golf Digest, 2026`
  - **Claim form:** Club Pilot was **featured in / included in** that roundup. Never write that Golf Digest called Club Pilot "one of the coolest new products" — see the accuracy note below.
  - **Why this wording:** the quote above is the article's actual verbatim headline (checked against the live article 2026-07-31). Byron's two remembered variants — "one of the coolest new products at the PGA Show in 2026" and "the coolest new products we found at the PGA Show 2026" — **do not appear in the article**, and Golf Digest never applies a superlative to Club Pilot specifically. What it actually says about Club Pilot is descriptive: "Club Pilot provides facilities with an easy-to-use platform to allow the club to train the AI on simple FAQs, so club members can send a text to Club Pilot's Siri or Alexa equivalent, Aimi." Quoting either remembered variant against the Golf Digest mark would be a misattributed quote.
  - Note the event's full name in the quote is the **PGA Merchandise Show**. "PGA Show" is fine in our own voice; inside the quotation it must stay "PGA Merchandise Show."
  - Live article: `https://www.golfdigest.com/story/best-new-golf-products-2026-pga-show`.
- **Golf Bizz Review** (Substack; internal docs also call it "Golf Business Review" — the outlet's own name is "Golf Bizz Review"). $100M feature: `https://golfbizzreview.substack.com/i/184763597/email-isnt-working-inside-golfs-100-million-communication-problem`. PGA Show booths feature: `https://golfbizzreview.substack.com/i/185168076/gbr-25-booths-worth-your-time-pga-show-2026`.
- **PGA Show 2026** presence (booth; credibility/press asset).
- **CMAA** (industry association; the confirmed high-close in-person channel).
- **USGA data-integration partnership** (daily handicap index into the app).
- Press logo files (on-dark) live at: `clubpilot.com/images/logo-white-golf-digest.png`, `logo-white-golf-bizz-review.png`, `logo-white-pga-show.png`, `logo-white-cmaa.png`.

**Notable customers / "Trusted By" (all `[GATED]` on written approval):** approved-for-social set is Salem Country Club, Sleepy Hollow, St. Andrews CC Boca Raton, Worcester, Lost City Golf Club, Willowbend, Breakers West, Essex County Club (+ monogram marks). Byron's confirming email still outstanding. Captions stay at "Trusted by" level: roster membership only, no result claims, no "clubs love us" phrasing, no implied quotes. Headdress mark runs organic-only, never paid.

---

## 9. CTAs & links

Confirmed live destinations (extracted from clubpilot.com):

| Goal | CTA | URL |
|---|---|---|
| Book a demo (primary conversion) | "Book a Demo" | `https://www.clubpilot.com/demo` |
| Watch the walkthrough | "Watch 3 Minute Walkthrough" | `https://www.clubpilot.com/interactive-demo` |
| Start a trial | "Free Trial" | `https://www.clubpilot.com/free-trial` |
| Learn how it works | "How It Works" | `https://www.clubpilot.com/how-it-works` |
| Compare vs alternatives | "Comparison" | `https://www.clubpilot.com/comparison` |
| Pricing | "Pricing" | `https://www.clubpilot.com/pricing` |
| Club login (existing clients) | "Log In" | `https://www.clubpilot.com/club` |
| Brand/story | "Our Story" | `https://www.clubpilot.com/about` |
| Blog / thought leadership | "Blog" | `https://www.clubpilot.com/blog` |
| Homepage | — | `https://www.clubpilot.com` |

**CTA-to-goal mapping for social:**
- The single **"ask" post** (at most 1 per batch, the 10% promote band as of 2026-08-26): an invitation, never a command ("We built a 3-minute tour because this is much easier to understand when you see it"), pointing at `/demo` or `/interactive-demo`. This is the only template that gets a painted CTA button and official app-store badges. Command-form openers (WATCH, SEE, CLICK, GET, TRY, BOOK) are banned on organic.
- **Give posts (4 in 5):** no ask, or at most a soft "learn more" pointing to `/interactive-demo` (watch the 3-minute walkthrough) or `/blog`. Proof/testimonial posts carry no CTA at all.
- **Follow/engage** is the implicit CTA on brand/humor/operator-POV posts, no link.
- **App-store links:** there is **no public Club Pilot app-store listing to drive to** — the member app is white-labeled per club. The consumer app-store presence belongs to **Golf Pilot** (separate product/lane). For Club Pilot B2B, default the ask to `/demo` or `/free-trial`, not an app store `[CONFIRM]`.

---

## 10. Guardrails & context

- **Legal/compliance:** Client entity is Golf Pilot, Inc.; governing law California, arbitration LA County. Private-club culture is the most privacy-protective segment in hospitality and the GM world is small (CMAA) — one unapproved club logo becomes a story other GMs hear. Hence the hard written-approval gate on every real club logo and every testimonial.
- **SMS/stat compliance:** "opened" for SMS technically means "delivered." Industry-benchmark attribution covers this; a precise measured claim does not. Never imply a benchmark is a Club Pilot outcome.
- **Sender-identity rule (anti-endorsement):** fabricated message threads use rotating fictional demo clubs only; a fabricated thread from a real club is an invented endorsement and is banned. Fictional names must not resemble any real approved club. (Imported design system uses the fictional roster: Fairhaven CC, Elmwood CC, Oakcrest CC, Stonebridge CC.)
- **Partner/co-marketing brands:** Marko / AdVantage Media handles Golf Pilot video and organic social — a separate lane, not part of this pipeline. Keep Golf Pilot's playful consumer tone out of Club Pilot content. Press logos are third-party marks — use provided on-dark files, present as recognition/roster only, no implied endorsement.
- **Seasonal/time-sensitive:** golf is seasonal. CMAA and industry events drive the in-person close; PGA Show 2026 is past (evergreen press, not a live event). No dated campaign currently locked `[CONFIRM if a seasonal push is wanted].`
- **Don't-embarrass checklist:** intelligence-first not AI-first; no em dashes; casing per resolved rule; no competitor names; no attacking email/apps/tradition; no fabricated faces or UI; benchmarks attributed and never fused; testimonials and club logos only from the written-approved set; Aimi peripheral and never the sender.

---

## 11. Notion workspace (relevant pages)

Workspace: Travis's consulting Notion (the CRM). Parent for this account: **Golf Pilot, Inc.** page (`https://app.notion.com/p/412434ccef364083b3a41bcd7fafa7be`).

- **Club Pilot: Content Pillar Strategy** — `https://app.notion.com/p/b56a6aa1213b48b3948b60640e1f9897`. The master social doc. Sub-databases: "Content pillars" (`collection://153d1999-6dd4-4cc6-bd92-f5f64ada5e1e`) and "Sample rotation" (`collection://71bdb80a-54a7-4db3-bb08-1b20fc501858`).
- **Club Pilot: The emotional core** — `https://app.notion.com/p/39d0a9f435b581308a54ed71c2ea9866`.
- **Complete Club Pilot design system** — `https://app.notion.com/p/9b520cb250ff4f819434789ba9e72a8a` (currently blank `[GAP]`).
- **Design System Brief Prompt** — `https://app.notion.com/p/83d5f7e90f384c50a0f479f4744fd4c5`.
- **Sprint 2 — Club Pilot (Jul 21–Aug 1)** — `https://app.notion.com/p/505cadbda1b7422bb0bf3b2a2074bed1`. Current sprint; first Club Pilot social batch runs through this pipeline to Buffer.
- **Sprint 1 — Club Pilot (Jul 16–22)** — `https://app.notion.com/p/46530200fb7548aba6de275f93e780e8`.
- **Kickoff — Jun 12, 2026** — `https://app.notion.com/p/2fa8327f5b634d9a809557c83cdcdc9f`.

**Supporting Google Drive docs:**
- **Byron_Voice_Guide** — `https://docs.google.com/document/d/1FS0vDbHFLeQec9BoIDJOmY-37POpSK7XfhcSYpiYt6g`.
- **ClubPilot_Growth_Partner_Proposal** — `https://docs.google.com/document/d/14IXN8yKl73nf1TuNw4g-7USqwv1ZTkj02J4TaKUYwvQ`.

---

## Open gaps to close before the pipeline runs at full confidence

1. Byron's one-email written approval of the Trusted By club set (and whether the website's current club logos are cleared for social).
2. Written testimonial approvals (name, title, club) — nothing unlocked yet.
3. The two undocumented greens (of the three-green mandate), plus `space.*`/`radius.*` token reconciliation vs. the imported Claude Design tokens.
4. Full logo lockup set (on-light, mark-only, clearspace/min-size) and the Figma file link.
5. Real product/UI screenshots for device-framed posts (no fabricated UI).
6. IG hashtag set and any dollar-level pricing that would ever appear in copy.
7. Company-page posting cadence number (Byron's personal page is 3–5x/week; company page rotation-driven but not fixed).

**Closed:** Exact Golf Digest wording — locked 2026-07-31 (approved by Travis). See the awards/press list in §8. Do not re-gate it.
9. **Headline casing rule (title case vs sentence case) — operator to confirm.**

---

## Retired lines

Never use these. They are recorded so a future session does not rediscover and reuse them.

- **"The smartest front desk you never had to hire."** Retired 2026-08-26. It implies staff
  replacement, which contradicts Trinity's explicit position that AI Assist does not replace staff or
  personal service, and it reads as criticism of the club's current front desk. It had already been
  placed on hold in `capability-boundary.md` §9 on Aug 12; Byron's Aug 26 direction retires it.
  Enforced in the gate's banned-phrase list.

---

## Changelog

Amendments preserve the superseded text here rather than deleting it, so the history stays legible.
Note: this repo has no `ClubPilot_locked_state_v3.md`; this file is where the locked state lives, so
the changelog lives here too.

### 2026-08-26 — Byron direction amendment (docs 01, 02, 03, Trinity, and the Aug 21 raw feedback)

- **§2 secondary positioning line (4.1).** Superseded text: "**Secondary line that tests well:**
  *The smartest front desk you never had to hire.*" Retired, see above.
- **§2 / §4 pillar 1 angle (4.2).** Superseded text: "**The front-desk leak.** Staff lose hours to
  the same member questions — a quantifiable labor cost plus lost higher-value work." The pillar
  survives as a taxonomy label; the angle is now a solvable industry pattern, never an accusation
  about the reader's club.
- **§8 contrast-pair treatment (4.3).** Superseded text: "Strongest single treatment is the contrast
  pair: texts are read at ~98% and answered in about 90 seconds, versus about 90 minutes for email."
  Retired: it is channel-versus-channel framing. The individual stats survive as attributed
  benchmarks in `approved-stats.json`.
- **§4 pillar 3 formats (4.4).** Superseded text listed "old-way-vs-intelligent-way side-by-side" as
  a production format. Retired; the gate fails any reference to it.
- **§3 / §5 / §9 give-to-ask (4.5).** Superseded text: "Give-to-ask holds at four give, one ask" /
  "four of five posts give ... one of five asks" / "The single 'ask' post (1 in 5)". Replaced by the
  50 / 25 / 15 / 10 editorial mix with at most one CTA post per batch.
- **§0.3 / §2 AI vocabulary (4.6).** Rule amended: "AI Assist" as a product name is permitted in
  headline position; the ban on leading with generic "AI" claims stands. Pending Byron confirmation.
- **§2 dual-track positioning (4.7).** New rule added: today's wedge (AI-powered text messaging) and
  the coming platform coexist; platform features are "what we're building" territory only, never
  available capability. `capability-boundary.md` governs both.
- **§2 / never-say (2.3).** New rule added: channel-versus-channel language retired; never imply any
  channel fails.
