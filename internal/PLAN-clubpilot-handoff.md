# Club Pilot content engine: handoff and productization plan

Prepared 2026-09-28. Internal to Applied Intelligence. Not for Byron as written; SOW v2 and the
runbook are the Byron-facing documents.

## 1. Decisions locked

| Decision | Choice |
|---|---|
| AI provider for Byron's pipeline | OpenAI API key on Byron's account. Codex (connected to his GitHub org) is the maintenance interface. Core engine stays provider-agnostic |
| Commercial frame | SOW v2 (Google Doc `ClubPilot_Content_Engine_Handoff_SOW_v2_2026-09-28`, copy in `internal/SOW-clubpilot-v2.md`) replaces the unsigned Sep 22 draft. Fee agreed with Byron and Aaron separately and not stated in the SOW. Case-study clause in SOW section 10. No obligation after the 30-day support window; further work only by separate agreement |
| Ownership | You keep the engine core and method. Byron gets a perpetual, non-transferable license and owns his repo, accounts, brand files, photos, generated content and his modifications |
| Look | Current Club Pilot look (dark/green, Montserrat). Expanded to ~15 reusable, token-driven layouts |
| Founder LinkedIn | In scope via source mode: Byron supplies a blog post or transcript, engine drafts spin-offs that restate his words, he approves each in Buffer |
| Cadence | Scheduled batch every 2 weeks, 8-10 posts (~IG 3/wk, LI 2/wk). Source-mode posts on top, on demand |
| Build start | Now, in a new private repo you own (`travi-trav3/content-engine`), with Club Pilot as the first brand. Copied into Byron's org at cutover |
| Operator | Byron. Aaron owns the GitHub org, secrets, and failed-run triage |
| Review model | Drafts only, never auto-publish. Byron's Buffer review replaces Travis's plan approval |

## 2. Where things stand today (verified 2026-09-28)

- **Engine** lives on `claude/club-pilot-social-pipeline-q5tvs6` in `travi-trav3/applied-intelligence`
  (unmerged, your website repo). It is session-driven: a Claude Code session wrote copy, hand-coded
  one HTML file per post with the copy inline (~60 one-off templates in Claude Design `.dc.html`
  format), rendered with Playwright, ran seven gates via `check-batch.js`, pushed PNGs to
  `travi-trav3/clubpilot-social-assets`, and scheduled through the Buffer MCP connector.
  **There is no generation code, no GitHub Actions, no parametric template, no Buffer API client.**
  The Sep 22 SOW's "carve out" is a rebuild of the generate, render, and schedule layer.
- **What is worth keeping:** the gates (capability, stat, brand, editorial, rotation, plan,
  diversity), `check-batch.js`, the regression suite in `verification/`, and the operating lessons
  in `clubpilot/CLAUDE.md` (Buffer gotchas, CDN stale-bytes rule, Golf Digest wording).
- **Buffer** (your org "Applied Intelligence Co.", shared with iEatz): Club Pilot Instagram is
  **disconnected**; Byron's LinkedIn is **locked**, most likely because 5 channels are connected on a
  4-channel plan; three batch-3 drafts dated Aug 28-30 are stale and off-strategy; nothing has
  posted since Sep 17.
- **Results, Jul 22 to Sep 17:** 42 posts. Instagram 1.2 reactions per post, LinkedIn 0.5 reactions
  and ~21 impressions per post. Comment counts are the scheduled first comments.
- **Brand layer is out of date.** BRAND.md, the pillars, and `capability-boundary.md` encode the old
  "AI text messaging" wedge. The Sep 2 Strategic Marketing Plan moves to connected communication:
  Email | Text | Mobile App | AI Assist, one inbox, one member history, surveys, workflows, staff
  communication. The brand layer is rewritten, not ported.
- **Byron, Sep 22:** "Where I get stuck is images." He writes long-form in ChatGPT and wants control
  of the creative. The render-and-draft step is what he values most.
- **Photography:** 87 Unsplash JPGs plus a `clublogos` subfolder in your Drive
  ("Photography: Club Pilot"), plus 13 photos and press/club logos committed on the engine branch.

## 3. Target system (outcome 1)

### Repositories

| Repo | Owner | Visibility | Holds |
|---|---|---|---|
| `travi-trav3/content-engine` | You | Private | The core: engine, layout kit, workflows, docs. Club Pilot as the first brand fixture during the build. Becomes the product template |
| `<byron-org>/clubpilot-content` | Byron | Private | His instance: a copy of the core plus `brand/`, `photos/`, `content/`, config, secrets |
| `<byron-org>/clubpilot-social-assets` | Byron | Public | Rendered images served to Buffer over raw.githubusercontent.com |

The instance is a copy, not a submodule. A submodule pointing at your private repo breaks the moment
he loses access, and the license lets him modify his copy.

### Instance layout

```
clubpilot-content/
  AGENTS.md                 primary instructions; Codex reads this. CLAUDE.md is a one-line pointer
  config.yaml               channels, cadence, CTA, provider + model, schedule, notify target
  brand/                    Byron-owned
    BRAND.md                v2: positioning, voice, never/always-say, pillars x territories
    capability-boundary.md  v2: what the product does today vs "what we're building"
    voice-reference-posts.md  approved posts in target voice, grows from his Buffer edits
    voice-edits.jsonl       every copy edit pulled from Buffer (original -> final)
    approved-clubs.json     written list from Heather; empty list = every real name blocked
    approved-stats.json     every number with a pinned citation
    locked-quotes.json      verbatim third-party quotes (Golf Digest)
    tokens.css              colors, type, spacing for the layout kit
  layouts/                  ~15 layouts x IG 1080x1350 and LI 1200x1500, props only, no copy inside
  photos/                   resized masters (2400px long edge) + library.json (tags, source, usage log)
  sources/                  source mode inputs: blog posts, transcripts
  engine/                   the licensed core
    generate/               plan + copy via LLM with JSON-schema output; provider adapter
    render/                 Playwright + sharp, self-hosted fonts, golden tests
    gates/                  ported gates + new ones (section 3.6)
    buffer/                 GraphQL client: drafts, first comments, read-back of text + notes
    feedback/               edits -> voice set, img: notes -> re-render, rule proposals
    publish/                push to assets repo, content-hashed filenames, verify 200 + sha256
  content/batch-NN/         plan.json, posts.json, ledger.json, contact-sheet.png
  .github/workflows/        batch.yml, on-push.yml, feedback.yml, ci.yml
```

### Three ways Byron drives it

1. **Does nothing.** Every other Monday, `batch.yml` puts 8-10 drafts in Buffer with proposed times
   and first comments, and sends him a summary with a contact sheet. He edits, approves, schedules.
2. **Edits in Buffer.** His copy edits flow back into the voice set before the next batch. A note on
   a draft starting with `img:` ("img: use a morning photo") triggers a re-render and an in-place
   asset swap that keeps his text edits. Verified: Buffer's API exposes `Post.notes`.
3. **Asks Codex.** "Add these photos." "Write a post about the new survey feature as a stat card for
   Thursday." "Never say effortless." "Here's my blog post, spin it off." Codex edits files and pushes;
   Actions does all execution with the secrets. Codex never holds the Buffer or OpenAI key.

### Workflows

| Workflow | Trigger | Steps |
|---|---|---|
| `batch.yml` | Weekly cron, runs when the last batch is 13+ days old (Actions cron cannot express biweekly) | feedback pull -> plan (LLM) -> plan gate -> copy (LLM) -> gates -> photo selection -> render -> contact sheet -> publish assets -> Buffer drafts + first comments -> ledger commit -> summary |
| `on-push.yml` | Push touching `content/**/posts.json` or `sources/**` | Render, gate and draft only what changed. Idempotent via the ledger |
| `feedback.yml` | Daily | Process `img:` notes, reconcile ledger against Buffer status, record edits |
| `ci.yml` | Every push | Gate regression suite + golden renders of every layout. A loosened gate or a broken layout fails loudly. This is the anti-drift control once Byron and Codex are editing |

Secrets (set by Aaron): `OPENAI_API_KEY`, `BUFFER_API_KEY`, `ASSETS_PUSH_TOKEN` (fine-grained,
assets repo only), notification target (email or Slack webhook, decided with Aaron).

### Layout kit (~15, proposed, for Byron's sign-off)

Three surfaces so adjacent posts never look alike. Each layout exists at IG 1080x1350 and LI 1200x1500.

| Surface | Layouts |
|---|---|
| Light paper | 1 type card, 2 numbered list, 3 stat card (big number + attribution), 4 quote card (founder or locked press quote), 5 question card |
| Dark | 6 message thread (fictional demo-club sender, "powered by Club Pilot" microline), 7 escalation thread (ends at handoff), 8 hub diagram (Email / Text / App / AI Assist into one inbox), 9 product screenshot in device frame (real UI only), 10 proof bar (press marks; Trusted By roster when the approved list allows) |
| Photo | 11 full-bleed headline, 12 photo band + body, 13 photo with thread overlay, 14 founder portrait, 15 carousel set (cover, inner, close) |

Layout 9 stays disabled until Aaron supplies real screenshots of the new dashboard. Layout 10's
Trusted By variant stays disabled until Heather's written list lands.

### Gates

- **Ported:** capability, stat, brand (banned phrases, sentence case, no em dashes, no single-word
  lines, no internal labels on creative), editorial (earns its place, humor mechanism and review),
  rotation, plan, diversity (message dedupe vs last 30 days), plan-ledger match. All references to
  "Travis approves" become "operator approves".
- **Rewritten inputs:** capability lexicon and product facts for the multi-channel product.
- **New:** source gate (every founder-voice sentence maps to a span in a file under `sources/`);
  layout adjacency gate across 15 layouts x 3 surfaces; names gate runs on rendered text as well as
  copy; locked-quotes gate (third-party quotes must match `locked-quotes.json` verbatim).

### Brand v2 inputs

Sep 2 Strategic Marketing Plan, Sep 2 Explainer Deck, Byron_Voice_Guide, Sep 22 call (product
updates: modular setup, instant member app on trial, new dashboard), Aug 26 direction amendment,
and his Buffer edits to batches 4-5. Open decisions for Byron: primary CTA (free trial vs book a
demo), whether Caddy Pilot ever appears on Club Pilot channels.

### Human in the loop

Drafts only. The Aug 6 capability overreach, two deleted humor posts and the invented founder quote
all shipped through a system with a human reviewer; unattended publishing removes the last control.
If Byron does not review, drafts sit in Buffer and nothing publishes. That is the safe failure.

### Byron's running costs

OpenAI API usage (low single-digit dollars per batch at this size; billed on platform.openai.com,
separately from his ChatGPT subscription; set a monthly limit), a Buffer plan that covers three
channels and API access (2026-10-08: the free plan, which allows exactly three channels; confirm its
API allowance covers sync, about 1,500 requests a month), GitHub Actions minutes (about 1,800 a month
with sync every 15 minutes in working hours, against 2,000 free on a free organization's private
repositories: put a card on the organization with a small spending limit, or jobs stop when the
minutes run out), GitHub hosting (free), Unsplash (free; the demo key's 50 requests an hour covers the
weekly scout many times over).

## 4. Timeline

Today is Mon Sep 28. Oct 20 acceptance from the Sep 22 SOW is no longer realistic; target Oct 23,
with Oct 30 as the slip date if Byron's dependencies land late.

| Week | You / me | Byron / Aaron / Heather |
|---|---|---|
| Sep 28 - Oct 2 | Create `content-engine` repo. Draft and send SOW v2. Start core: repo skeleton, render harness portability, gates port. Draft brand v2 | Sign SOW v2. GitHub org (Aaron). OpenAI API key with billing. New Buffer account with Club Pilot IG, LinkedIn page and Byron's LinkedIn connected, API key. Heather's approved-clubs list. CTA decision |
| Oct 5 - 9 | Build: 15-layout kit, generator, Buffer client, feedback, photo library ingest, workflows, CI. Dry-run batch against the Club Pilot fixture | Brand v2 sign-off by Oct 7 (30 min). Aaron: dashboard screenshots |
| Oct 12 - 16 | Instance into Byron's org. Run 1 live (Mon). Run 2 (Thu) reflecting his edits and one `img:` note. Source-mode test on one of his blog posts. Runbook + AGENTS.md | Aaron sets secrets. Byron edits run 1 in Buffer and leaves at least one `img:` note |
| Oct 19 - 23 | Training (90 min, recorded). Gate test. Acceptance. Remove your credentials. Cutover (section 6) | Accept by email. 30-day support runs to ~Nov 22 |

## 5. Acceptance criteria (for SOW v2)

1. Two consecutive runs complete in Byron's GitHub org without your intervention, each delivering a
   full batch to Buffer as drafts with first comments.
2. Run 2 reflects at least one copy edit and one `img:` note from run 1.
3. One source-mode run turns a Byron-supplied blog post into spin-off drafts that pass the source gate.
4. A test post with a real club name not on the approved list fails the gate and does not render.
5. `ci.yml` passes; all 15 layouts render at both sizes against golden images.
6. No credential of yours remains in the repo, the org, Buffer, or the OpenAI account.
7. Runbook delivered; training held and recorded.

## 6. Cutover and cleanup (your side)

- Delete the three stale batch-3 drafts in your Buffer (with Byron's OK); disconnect Club Pilot IG,
  Club Pilot LinkedIn and Byron's LinkedIn from your org. This also frees your channel slots.
- Tag and archive the engine branch in `applied-intelligence` (`archive/clubpilot-engine-2026-09`);
  delete the two `claude/club-pilot-*` branches after tagging.
- Keep `travi-trav3/clubpilot-social-assets` public and untouched until Buffer no longer references
  it, then archive. Do not delete: published posts' Buffer history points at it.
- Move the photo masters out of your Drive into Byron's repo; keep the Drive folder read-only until
  acceptance, then transfer or delete.
- Revoke the Buffer MCP connector's access to Club Pilot channels; remove any Club Pilot secrets
  from your environments.
- Retire or rewrite the `social-content-pipeline` skill to point at `content-engine` instead of
  the playbooks on the website repo branch.

## 7. SOW v2: changes from the Sep 22 draft

- Provider: OpenAI API on Byron's account, Codex for maintenance. Remove "porting to another
  platform" from out-of-scope; it is now the plan.
- Scope adds: brand v2 rebaseline to the Sep 2 positioning, 15-layout kit, source mode for founder
  LinkedIn, photo library migration, CI anti-drift suite.
- Keeps: feedback loop, names gate, runbook, recorded training, two acceptance runs, drafts only.
- Fee: agreed with Byron and Aaron separately; the SOW says only that it was agreed and is not
  restated. Case-study clause (SOW section 10): permission to name Club Pilot, describe the
  engagement, and show published posts and non-confidential results; Client can ask in writing
  to leave specific items out of future use.
- License: same substance as the Sep 22 draft, with one deliberate change. The Sep 22 draft made
  "templates" Client property. SOW v2 makes the reusable layout code part of the engine (yours)
  and makes design tokens, logos and photos Client property. That is what lets the 15-layout kit
  become the product's base kit.
- Support: 30 days of defect support, then no obligation. No tune-up price in the SOW; any further
  work is by separate written agreement.
- Transition (SOW section 9): old engine stops at signature, no batches until the first live run,
  Club Pilot channels leave your Buffer at cutover, the three stale August drafts are deleted
  unless Byron objects, the old public image repo stays online.
- Timeline: signature by Sep 30, dependencies by Oct 5, acceptance Oct 23, day-for-day slip.

## 8. Outcome 2: the productized offer

### Principle

Club Pilot is client #1. Build the core in your repo with a clean seam between `engine/` and
`brand/`, and extract the reusable template after acceptance, when you know what is actually
generic. Generalizing before one real handoff is guessing.

### What exists after Club Pilot

1. **`content-engine` as a GitHub template repo:** engine, provider adapter (OpenAI and Anthropic),
   15-layout base kit re-skinned by `tokens.css`, blank `brand/` intake files with prompts,
   workflows, CI, AGENTS.md template, RUNBOOK template.
2. **`content-engine-delivery` skill** in your Claude account: runs the 4-week program. Intake
   interview script, week-by-week checklists, SOW and acceptance template, training agenda,
   handover checklist, tune-up menu.
3. **Case study** from Club Pilot: time saved, batch cycle time, what the gates caught.

### The moat: Club Pilot's incidents become every client's default gates

| Club Pilot incident | Default gate |
|---|---|
| Aug 6: depicted booking and transactions the product cannot do | Capability gate against the client's signed capability boundary |
| Unsourced "four hundred a week" and derived hours | Stat gate: numbers only from an approved list with a citation |
| Aug 24: invented founder experience | Source gate: founder voice restates a recorded source |
| Aug 15-16: two humor posts published and deleted | Humor is review-first and must name its mechanism |
| Batch 3: 7 of 11 posts said the same thing on 8 of 11 identical cards | Message dedupe + layout and surface adjacency gates |
| Real club name not on an approved list | Names gate against a written list; empty list blocks all |
| Golf Digest paraphrase attributed as a quote | Locked-quotes registry, verbatim only |
| Template sample copy shipped ("Want me to book one?") | Layouts carry no copy; props only |
| Internal pillar labels printed as eyebrows | Planning vocabulary never renders |
| CDN served stale bytes after overwrite | Content-hashed filenames + served sha256 check |

### Delivery program

| Phase | Work | Client sign-off |
|---|---|---|
| Pre-kickoff (clock does not start until done) | Access checklist: GitHub org, AI key with billing, Buffer with channels connected and API key, photo source, named approvers for claims and names, named operator with 30 min every 2 weeks | Access complete |
| Week 1: discovery and brand kit | Product truth and capability boundary session (90 min), voice and pillars session (60 min). Outputs: BRAND.md, capability boundary, approved claims, approved names, never-say, 10 voice reference posts, pillar x territory map, tokens | Brand kit signed Friday |
| Week 2: infrastructure | Instance from template, tokens into the 15 layouts, photo library, workflows, secrets, dry-run batch, contact sheet review | Dry-run look approved |
| Week 3: live refinement | Run 1, client edits in Buffer, run 2 with feedback applied, source-mode test, rule tuning | Two runs reviewed |
| Week 4: handover | Runbook walk-through, recorded training, acceptance, credential removal | Acceptance email |
| After | 30-day support, fixed-price tune-ups | |

Week 3 cannot be compressed: the feedback loop needs two live cycles of the client's own edits.

### Qualification (do not sell to clients who fail these)

- Someone will review a batch for ~30 minutes every two weeks.
- They can grant channel access before kickoff (Club Pilot's LinkedIn page access was "outstanding
  since June").
- They have a product-truth owner who will sign a capability boundary.
- They accept that the offer is brand-safe content operations in their own accounts, not growth.
  Company-page organic at small follower counts earns roughly one reaction per post; reach comes from
  founder and employee accounts, which source mode supports.

### Pricing notes

Byron suggested $10K on Sep 22 (with a partner split). Price custom layouts beyond the base 15
separately. Tune-ups at a fixed price per defined change.

## 9. Risks

| Risk | Mitigation |
|---|---|
| Voice drift from the provider switch (rules were tuned on Claude) | Voice references + his edit history in the prompt, gates unchanged, run 1 and run 2 are the validation |
| 15 layouts x 2 sizes is 30 renders to build and QA in one week | Golden-image tests from day one; build shared primitives (headline block, thread, photo crop) first |
| Byron edits gates or prompts via Codex to force one post through | `ci.yml` regression suite fails the push; runbook explains how to add an exception without loosening a gate |
| Dependencies late (org, keys, Buffer, club list) | Build proceeds in your repo; day-for-day slip in SOW v2 |
| Instagram channel currently disconnected | Reconnect in Byron's new Buffer before run 1 |
| Buffer API changes or rate limits | Ledger makes every step idempotent; runbook covers resume |
| raw.githubusercontent caching | Content-hashed filenames, verify served sha256 before drafting |
| Byron's appetite for per-post creative control | `img:` notes and Codex requests are the outlet; the layout kit bounds it |
| Payment | 50% on signing |

## 10. What is needed now

Done 2026-09-28: `travi-trav3/content-engine` created; this plan and SOW v2 committed under
`internal/`; SOW v2 created as a Google Doc next to the Sep 22 draft.

1. You send SOW v2 to Byron. Its section 7 table is the dependency checklist, so no separate email.
2. Every day the section 7 items slip moves acceptance a day.

## 11. Build log

### 2026-09-28, increment 1 (branch `claude/sweet-gauss-y7r4ct`)

Done:
- Gates ported to `engine/gates`, paths resolved through `engine/lib/workspace.js`. The Aug 26
  regression suite passes against `brands/clubpilot`, plus one new case proving the operational
  facts file resolves (the gate used to skip that check silently when the file was missing).
- Renderer in `engine/render`: layout + props to PNG at IG 1080x1350 and LI 1200x1500 from one
  1080x1350 design canvas. Pinned Chromium 1194 via playwright-core 1.56.1. Verifies fonts and
  images, auto-fits type, flags overflow, off-canvas text and single-word lines.
- Layout 1 (type card) on dark and light, with goldens. CI runs both suites on every push.

Needs Byron's sign-off (add to the brand files review):
- The light surface. Club Pilot's current system has none; it is built from the brand's own ink and
  greens on off-white, with the deep brand green for headline emphasis because the bright greens are
  under 3:1 contrast on paper.
- The on-light wordmark, derived by recoloring the white letters of the on-dark file. BRAND.md
  already lists the on-light lockup as an open gap; an official file replaces it.

### 2026-09-28, increment 2

Done:
- Layouts 2 to 8: numbered list, stat card, quote card, question card (light and dark), message
  thread, escalation thread, communication hub (dark). 26 goldens, all clean at their largest type.
- The escalation thread takes exactly four beats (question, offer, reply, handoff) plus the inbox
  status chip. There is no prop for anything after the handoff, so the capability boundary's safe
  pattern is the only thread this layout can draw.
- The stat card renders one number and refuses to render without a source.
- Fitting is per box, so a long chat bubble no longer shrinks the headline. Headlines use
  `text-wrap: balance` and checked text `text-wrap: pretty`; the type card now wraps "There is no /
  best channel." exactly as the hand-set batch-5 original did.
- Tests: layout contract (fixture, surfaces defined by the brand, no hex colors), prop validation,
  escalation structure. `engine/render/contact-sheet.js` for batch summaries.

Needs Byron's sign-off, in addition to the above: the handoff status wording "Marked for the club
team".

Next increment: layouts 9 to 15 (product screenshot, proof bar, the four photo layouts, carousel),
which need the photo library; then generation against the OpenAI API; then the Buffer client.

### 2026-09-29, increment 3

Done:
- Photo library in `brands/clubpilot/photos`: 76 of the 87 Drive photos plus Byron's headshot, resized
  to 2400px, measured (brightness, calm zones, full-bleed and band resolution) and reviewed (subject,
  time, people, tags, crop focus). Two restricted, three marked never-name. `engine/photos` has ingest,
  review and selection (reviewed and unrestricted only, 30-day reuse window, least recently used first).
- Layouts 9 to 15: product screenshot, proof bar, full-bleed photo, photo band, photo thread, founder
  portrait, carousel step. Fifteen layouts, 44 goldens. `engine/render/carousel.js` renders 2 to 10
  slides and numbers them itself.
- The renderer refuses photos that are unknown, unreviewed, restricted, under-resolution or missing a
  required tag, and flags any photo shown above 1.1x its pixels (`render.photoTooSmall`). The founder
  layout takes only a photo tagged `founder`; the product layout takes only a real screenshot tagged
  `product-screenshot` and is refused for Club Pilot until one exists (tested).
- The proof bar reads logos from a registry in `render.json` with each logo's true relation, and
  derives its label from it, so "As featured in" cannot sit over an event Club Pilot exhibited at. A
  customer logo needs its written approval recorded.
- Fixed a QA blind spot: a bottom-aligned text box that overflowed upward reported clean. Found when
  the photo thread's headline clipped under the wordmark; the check now compares children to the box.
- Goldens are lossless WebP (17.5 MB to 9.8 MB, pixel-identical), and CI fails on a missing golden
  instead of creating one.

Needs Byron (add to the brand files review):
- The 11 photos too large for the Drive connector, the shot list in `photos/README.md` (staff, dining,
  interiors, members with phones), a high-resolution headshot, and real product screenshots.
- Customer club logos: confirm the written approval (BRAND.md contradicts itself) and send transparent
  high-resolution files. CMAA's relation, if it is to appear in a proof bar.
- A skim of the photo review (tags and restrictions were set by Claude from contact sheets).

### 2026-09-30, increment 4

Done:
- Generation in `engine/generate`: plan, write, gate, render and record a batch with one command.
  OpenAI provider on the Responses API with strict JSON-schema output (no SDK, key from the
  environment only), and a recorded-response provider so everything is tested without a key.
- The plan step revises against the plan gate, the rotation rules and engine consistency checks; the
  write step validates props and picks photos; posts that fail a gate or render badly are rewritten
  with the finding quoted. What still fails lands in `report.md` for a person.
- A recorded ten-post batch (Oct 5 to 18) that passes every gate, used by `test/generate.test.js`. Two
  of its first drafts repeated batch-5 wording and were caught by the diversity gate; the recorded
  revisions pass, so the test runs the real rewrite loop.
- Plan gate: `approvedBy` or `review: "buffer-drafts"`. Automated plans say honestly that nobody
  approved them and that every post is a Buffer draft a person reviews. Regression cases added.
  Humor stays out of automated batches (the editorial gate still requires a named approver).
- Brand gate: the visible-text checks that ran on legacy HTML templates now run on what the renderer
  drew for generated posts (powered-by line on threads, no planning labels, no Aimi as sender).
- `check-batch.js` exposes `checkAll()`; command output is byte-identical for batches 1 to 5.
- Layouts declare their rotation format; `diagram` and `screenshot` added to the format list.

Decided in the build, for Byron's review:
- Cadence is 5 LinkedIn + 5 Instagram per two weeks, not 4 + 6: the plan gate requires LinkedIn to
  carry at least half of every batch (D15), and the gate wins over the earlier cadence note.
- Automated batches never include Humor.

Open:
- The model name in `config.json` is a starting value; confirm it when Byron's key is set up.
- Next: publish renders to the assets repo (content-hashed names, verify 200 + sha256), Buffer
  client (drafts, first comments, notes read-back), scheduled workflows, source mode, carousels.

### 2026-09-30, increment 5 (decisions from Byron via Travis)

- All four channels are written as live; the engine launches when they are. BRAND.md live overrides
  and a new capability-boundary section 0 describe Club Pilot 2.0 from Byron's own materials. Match-up
  and topics-of-interest in the app are marked CONFIRM.
- Capability gate, context decides: book, booked, booking, books and tee sheet fail only on posts that
  depict the assistant (b2-08, the court "booked from the car", still fails); idioms such as "pay
  attention" and "in order to" no longer trip pay and order; a new check fails claims that Club Pilot
  connects to, syncs with or reads from the tee sheet, reservations, POS or club management software.
  Historical verdicts changed only for the two demo CTAs (b1-09, b2-09) and b1-01's tee-sheet mention.
- CTAs: one post in four (config `cta.every`), never two in a row on a channel (plan gate), from a
  rotating library of eight soft meet-the-team lines chosen least recently used and appended by the
  engine. Regression and generator tests cover both.

### 2026-09-30, increment 6 (carousels and humor in the plan)

- Carousels are planned: one post in three (config `carousel.every`), kinds reveal-flip, list and steps,
  4 to 8 slides, on Instagram and the company page. The carousel set (layout 15) is cover, step,
  reveal and close; steps number from 01 and reveal-flip evidence slides are unnumbered. Every gate
  reads every slide; slide findings route back to their post. The rotation cap of three per format
  does not apply to carousels because the brand sets their frequency; every other rotation rule does.
- Humor is planned: one post in five (config `humor.every`). The editorial gate accepts Byron's review
  of the Buffer draft as the approval humor requires; mechanism and no-footer rules unchanged.
- Approvals: Byron only. Aaron has no approval role (Travis, 2026-09-30). Setup work Aaron was down
  for (the Google service account) moves into the build.
- The recorded batch now has 3 carousels, 2 humor posts and 2 asks, and passes every gate. The
  per-slide brand checks caught three real defects in the stand-in copy on the first run.
- Every carousel ends on an end card (carousel-cta) after its close: one ask per carousel, in the
  brand's words from `cta.endCards`, rotated least recently used; carousels never also ask in the
  caption. Caption asks stay at one in four across the other posts.

### 2026-10-01, increment 7 (Buffer, the edit loop, workflows)

Decided (Travis): humor carousels skip the end card. Byron asked (Slack, Sep 30) how to change an
image: Byron does not edit the graphic, but leaves a note on the Buffer draft and gets a new version
in the same draft; captions are edited directly in Buffer. That loop is what this increment builds,
ahead of the Drive photo sync and the photo scout, because Byron called it "the real snag".

Done:
- `cta.endCardSkipPillars: ["Humor"]`.
- Sep 30 home page draft folded in: BRAND.md override "where clubs start" (text and AI Assist first,
  the rest at the club's pace), capability boundary section 0 (stepwise adoption, AI Assist setup as
  the page describes it). The page says Golf Digest named Club Pilot "a leader in the SMS space"; the
  article does not. New gate rule `brand.pressClaim` fails any judgment attributed to Golf Digest;
  the locked quote still passes. Flag the website line to Byron.
- Buffer client (GraphQL, verified against the live schema and existing posts: notes readable, not
  writable; an Instagram carousel is a "post" with several images; raw.githubusercontent.com images
  work). Assets host: public repo via the contents API, content-hashed names, served bytes verified.
  LinkedIn carousels go up as a PDF so they swipe.
- Push: drafts only, at planned times, CTA line, first comment, alt text, engine tag; skips posts
  that fail a gate, lack a channel or missed their slot; idempotent via the ledger.
- Sync (15 minutes, 7am to 7pm Pacific): a note is read by the model, the post rewritten, gated and
  rendered, and the images swapped in the same draft, tagged Revised. Photo and caption stay unless
  the note asks. Impossible asks are tagged Needs a look and explained. Caption edits recorded, and
  tagged Check caption if they trip a gate (never rewritten). Approvals, deletes, publishes recorded.
  Everything lands in `feedback/log.jsonl`, whose summary the next batch's planner and writer read.
- Workflows for the instance (`instance/`): batch (weekly cron, generates when due, which makes it
  biweekly) and sync. Sync installs Chromium only when a note needs a render.
- `test/buffer.test.js`: client and host against stubbed fetch, a recorded batch pushed to an
  in-memory Buffer, and a reviewer's week (schedule, edit, delete, publish, five kinds of note, an
  outage).

Needs before run 1 (Byron or Travis):
- A Buffer org for Club Pilot with Instagram (currently disconnected in Travis's org) and the LinkedIn
  page connected; Byron's personal LinkedIn is locked there (5 channels on a 4-channel plan). API key.
- A public `clubpilot-social-assets` repo in Byron's org and a token scoped to it.
- A Slack webhook for messages to Byron, and Byron's Buffer email for `buffer.reviewers`.
- GitHub plan minutes: sync uses about 1,450 a month at this schedule.

Open:
- LinkedIn document posts through the API are untested against a live account; run 1 settles it
  (fallback: `buffer.linkedinCarousel: "images"`).
- Promised to Byron in Slack, not built: the monthly theme input (brief mode).

### 2026-10-03, increment 8 (brief mode)

The monthly theme input promised to Byron in Slack. Byron's October map is the acceptance test.

Done:
- `engine/generate/brief.js`: a brief is any file in `briefs/` (Word, Markdown, text). The model reads
  it once into structured items (month, story, weekly themes, creative rules, each idea's hook, beats,
  reveal, body, sources, copied as written), saved beside it as JSON with the source hash. A batch is
  offered the ideas whose week has started and that nothing used; at least `brief.minShare` (0.3) of
  its posts take one, each once, never before its week. Format stays the engine's: the rotation, the
  carousel and humor shares and the gates still decide. Founder ideas wait for source mode; blog posts
  are outside the engine.
- Every idea runs through the content gates when the brief is read. On the October map: idea 03 cites
  four numbers that are not in approved-stats.json (43.46%, 2.09%, 7%, 3.6 million) and compares
  channels by the numbers (retired by Byron on Aug 26); idea 05 sets an email announcement against a
  text update; Byron's week-4 topic cites "40+ integrations". The writer is told to keep the idea and
  drop the number or the comparison.
- Instance workflow `brief.yml`: a brief pushed to `briefs/` is read and the reviewer messaged with what
  the engine will use and what trips a check. Batch reports list what each batch used and what is open.
- The recorded batch (Oct 5 to 18) now takes three ideas from the October map (04, 06, 09), each in a
  different layout (hub diagram, list carousel, message thread).

Decisions for Byron:
- Approve the four benchmark numbers in idea 03 with their sources, or let the post run without them.
- The map's cadence (Instagram 3 a week, Byron's LinkedIn 1 a week) against the engine's (5 company-page
  LinkedIn + 5 Instagram per two weeks, LinkedIn at least half by the plan gate). Unresolved since Sep 30.
- How Byron gets a brief in: GitHub upload today; a Drive "Briefs" folder with the Drive sync.

### 2026-10-03, increment 9 (photo reuse fix, Drive library)

Fixed: nothing in the pipeline recorded photo use, so the 30-day reuse window only worked inside a
batch. Selection now counts every photo an earlier ledger post carried (a deleted draft excepted).

Done:
- The photo library in Byron's Drive: Inbox, Active, Parked, Retired, Needs a look, Briefs. A photo
  dropped in Inbox is resized, measured and read by a vision model (subject, time, people, tags, focus,
  concerns) and moved to Active, or to Needs a look with the reason (a logo, a recognizable face, real
  club signage, screen text, poor quality, not a club setting). Byron's moves set the library state;
  moving a flagged photo to Active is a recorded override. A photo used 5 times retires itself; a
  duplicate upload is retired; a deleted file is retired. Each file's Drive description shows its
  state, tags and use. Briefs dropped in the Briefs folder (Word or Google Docs) are copied and read.
- Drive client on the API directly (service-account JWT signed with Node's crypto, no SDK), an
  in-memory Drive for tests, image input on the OpenAI provider, instance workflow `photos.yml` (four
  times a day; "seed" once to upload the existing 77 photos).
- AGENTS rule 6 amended: the vision reading is the one automated review, and only for photos Byron
  uploaded; any concern keeps a photo restricted until a person moves it.

Needs before it runs (Travis): a Google Cloud project with the Drive API, a service account and its key
as `GOOGLE_SERVICE_ACCOUNT_JSON`, the folder shared with it, its id in `config.json`. Not yet run
against a live Drive or the live vision model.

### 2026-10-03, increment 10 (the weekly photo scout)

Done:
- `engine/photos/scout.js` + `unsplash.js`: Monday mornings, up to 8 candidates where the library is
  thinnest (counts per subject in `scout.subjects`), searched on Unsplash, read by the vision model (a
  concern or a different subject drops one; at most 3 readings per suggestion), uploaded to the Drive
  folder Suggested named so the photographer is credited, with why it was picked. Never Unsplash+, never
  under 2400px, never one already in the library, suggested, screened or rejected. Downloads are
  reported to Unsplash per its API terms.
- Drive sync: a suggestion moved to Active (or any photo dropped straight into Active) joins the library,
  the move being the approval; Rejected is remembered by the scout.
- Instance workflow `scout.yml`; tests on a recorded Unsplash.

Needs (Travis): an Unsplash developer app and key (`UNSPLASH_ACCESS_KEY`). The scout cannot fix the
staff, members, dining and events gap: those need Club Pilot's own photos (the half-day shoot).

### 2026-10-05, increment 11 (preflight, Byron's repository)

Done:
- `engine/doctor.js` (`npm run doctor`): config, secrets and every live service a run needs (OpenAI
  model, Buffer organization and channels, assets repository and token, Slack, Drive folder, Unsplash),
  each failure with what to do about it. `--slack-test` sends a test message. Exits non-zero until ready.
- `scripts/make-instance.js`: builds Byron's repository from this one. The engine, layouts, tests, CI
  and package files; the five workflows set to `brands/clubpilot` (`CE_WORKSPACE`); `docs/INSTANCE.md`;
  a README; and an AGENTS.md that opens with where each of Byron's asks goes (photos, never-say rules,
  briefs, cadence, CTAs, one draft) and what never to do, then carries every core rule. Never ships:
  `internal/`, `instance/`, the script itself. `--update` replaces only what the core owns, so later
  engine releases never touch Byron's brand files, photos, briefs, batches or feedback.
- `test/instance.test.js` builds the instance, runs the gate regression suite and the preflight tests
  inside it, and checks an update keeps Byron's edits.

Open (Travis, before a second client): test fixtures are Club Pilot's and `test/` ships whole. Move
fixtures under their brand first.

Cutover, once the dependencies exist: `node scripts/make-instance.js --brand clubpilot --out <dir>`,
push to Byron's private repository, add the six secrets, fill `config.json` from
`node engine/buffer/setup.js`, `npm run doctor` until ready, then run `batch` by hand with "force".

### 2026-10-05, increment 12 (source mode: Byron's own LinkedIn)

Done:
- `engine/generate/sources.js`: Byron's material in `sources/`. Documents, call transcripts (only his turns
  count; an interviewer's words are never his), and voice memos from his phone, transcribed once by the
  OpenAI provider (`founder.transcribeModel`) and saved beside the audio. The Drive folder `Sources` is
  copied in by the Drive sync.
- `engine/gates/source-gate.js`: every sentence of a founder post carries the exact quotes it restates.
  Quote found word for word, in Byron's turn; numbers, names, at least 60% of the words, and any negation
  carried by the quotes; caption exactly the sentences plus the sign-off; no first comment. Regression
  cases: the Aug 24 post fails, and so does his Aug 21 complaint turned into his biography.
- `engine/generate/founder.js`: two founder slots a batch (Tuesdays 7:40) on `linkedin_byron`, in
  `ledger.founder`, outside the company plan and rotation. Each takes the October map's founder idea for
  its week. Written, gated, rewritten with findings. Without enough of Byron's words on the topic,
  nothing is written: the slot waits and Byron gets three to five questions to answer out loud into his
  phone. New material retries the waiting slots (`founder.yml` on push, and `photos.yml` after the Drive
  sync). Drafts are text only; a note on one is revised from the same material, and a caption Byron edited
  in Buffer counts as his words.
- Preflight warns when founder posts are on without his channel or material.

Decisions for Byron:
- The sign-off. BRAND.md says founder copy signs "Cheers, Byron White, Founder, Club Pilot", so
  `founder.signOff` carries it. On his own profile it repeats his name under his name. Recommend
  dropping it there (one config line).
- Cadence: one post a week, as his October map says. BRAND.md targets 3 to 5 a week on his profile;
  each more a week needs about one more voice memo a week.
- Weeks 2 and 4 of the October map ask him to talk about connecting with operational providers and
  "40+ integrations". The capability gate fails any claim that Club Pilot connects to, syncs with or reads
  from club systems, and "40" is not an approved number. His own recorded words do not override either.
  If partnerships are a story he wants to tell, BRAND.md needs a line on how: ambition and philosophy,
  never a present integration.
- His LinkedIn is locked in Buffer (5 channels on a 4-channel plan). Until it is connected, founder
  posts are written and wait, undrafted.

### 2026-10-08, increment 13 (Byron's decisions via Travis)

- No sign-off on posts. BRAND.md override and changelog; `founder.signOff` null. Email copy keeps it.
- Two posts a week on each channel: Instagram and the company page lose one slot each in week 2 (Wed
  LinkedIn, Sun Instagram), so 4 + 4 per batch; Byron's LinkedIn goes to Tuesday and Thursday 7:40,
  4 per batch. The plan gate's limits hold at 8 posts (LinkedIn exactly half, surface cap 3, 2 to 3
  carousels, 1 to 2 humor, at most 2 asks). The recorded test batch keeps its 10-slot calendar in
  `test/fixtures/generate/clubpilot/recorded-cadence.json`.
- Correction to increment 12: the October map's weeks 2 and 4 pass the gates as Byron wrote them. Only
  "40+ integrations" tripped (stat gate), and that number is WriterAccess's, not Club Pilot's. It is now
  an approved stat citing the map, scoped to sentences that name WriterAccess (new opt-in
  `"scope": "sentence"` in approved-stats.json), so "Club Pilot has 40+ integrations" still fails.
- Testing those topics found a real gap: "Club Pilot connects with the operational systems clubs already
  rely on" passed, because the integration check named only the tee sheet, reservations, POS and club
  software. Generic names now fail as a present-tense claim; Byron's ambition ("we want to connect
  with...") passes. Regression cases both ways; no historical verdict changed.
- Founder posts at 2 a week need about two memos a week, or one memo covering two topics. The October
  map has one founder topic a week; the other slot writes from the strongest unused idea in his sources.
