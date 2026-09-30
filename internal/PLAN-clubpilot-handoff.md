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

OpenAI API usage (low single-digit dollars per batch at this size), a Buffer plan that covers three
channels and API access (confirm API key availability on the plan he picks), GitHub Actions
minutes (well inside the free allowance at biweekly cadence), GitHub hosting (free).

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
