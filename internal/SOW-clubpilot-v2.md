# Statement of work

**Club Pilot content engine: rebuild and handoff**

_Addendum to the Consulting Agreement executed June 12, 2026  ·  Prepared September 28, 2026  ·  Applied Intelligence Consulting_

_This SOW replaces the unsigned draft dated September 22, 2026._

## 1. Parties and reference

|  |  |
|---|---|
| Consultant | Travis Enos, d/b/a Applied Intelligence Consulting    travis@appliedintelligenceai.co |
| Client | Golf Pilot, Inc., represented by Byron White, Founder    byron@golfpilot.com |

This statement of work (SOW) is an addendum to the Consulting Agreement between the parties executed June 12, 2026 (the Agreement). Every term of the Agreement applies unless this SOW says otherwise. Where the two conflict, this SOW controls for the work described here and nothing else.

## 2. Summary

| Item | Terms |
|---|---|
| Project | Rebuild the Club Pilot content engine so it runs on a schedule in Client's own accounts, drafts posts into Client's Buffer, and is operated and maintained by Client's team. |
| What Client gets | The engine running in Client's GitHub organization on Client's OpenAI and Buffer accounts; brand files rewritten to Club Pilot's current positioning; up to 15 reusable layouts in the current Club Pilot look; source mode for Byron's LinkedIn; a feedback loop from Buffer; content checks; the photo library; a runbook; recorded training; a perpetual license. |
| Channels | Club Pilot Instagram, Club Pilot LinkedIn company page, and Byron White's LinkedIn. |
| Operator | Byron White. Reviews drafts in Buffer, about 30 minutes every two weeks. |
| Technical administrator | Aaron Robinson. Owns the GitHub organization and account keys, and handles failed runs. |
| Timeline | About three weeks from the day the dependencies in section 7 are in place. Target acceptance October 23, 2026. |
| Support after handoff | 30 days of defect support after acceptance. After that, Client operates and maintains the engine (section 11). |
| License | Perpetual, non-exclusive, non-transferable license to run and modify the engine for Club Pilot and Golf Pilot marketing (section 10). |

## 3. What this is and what it is not

This section is here so both parties read the rest of this SOW the same way.

### What it is

- An engine Club Pilot runs itself. After acceptance, Client operates it, reviews its drafts and maintains it. The runbook and working notes are written so that Codex, or another coding agent, can make changes on Client's behalf.
- A drafting system. Every post arrives in Buffer as a draft. Nothing publishes until someone at Club Pilot approves it.
- A system that carries Client's corrections forward. Copy edits and image notes left in Buffer shape the next batch.

### What it is not

- Not a managed service. Consultant does not operate, monitor, review or publish anything after acceptance.
- Not an auto-publisher. It never publishes a post on its own.
- Not a guarantee of results. It produces on-brand drafts on a schedule. It does not guarantee reach, engagement, followers, leads or sales.
- Not self-learning. It improves only from the edits and notes Client leaves in Buffer. No edits, no improvement.
- Not a new brand or visual identity. The layouts use the current Club Pilot look.
- Not a web app or dashboard. Review and editing happen in Buffer, and the engine lives in GitHub.

## 4. Background

Today the engine runs in Consultant's environment. Consultant produces each batch in a working session and schedules it through Consultant's Buffer account. The engine's brand files describe Club Pilot as AI-powered text messaging, which predates the connected-communication positioning in Club Pilot's Strategic Marketing Plan of September 2, 2026. Client edits posts in Buffer, but those edits do not flow back into the engine.

Client has asked to own and operate the engine. This SOW rebuilds it in Client's accounts, updates it to Club Pilot's current positioning, and hands it over.

## 5. Deliverables

### D1. Engine running in Client's accounts

- A private repository in a GitHub organization Client owns holds the engine and all Club Pilot material. A public repository in the same organization serves rendered images to Buffer.
- The engine runs on a schedule in GitHub Actions using Client's OpenAI API key and Client's Buffer API key. Planning, copywriting, image rendering, the checks in D7, image hosting and Buffer drafting all run there. Nobody has to open a coding tool to produce a batch.
- Channels, schedule, batch size, call to action and AI model are set in one configuration file.
- Every Consultant credential is removed at acceptance. Client holds every key, token and login.

### D2. Brand files updated to current positioning

- Consultant rewrites the engine's brand files from Club Pilot's Strategic Marketing Plan (September 2, 2026), the Club Pilot Explainer Deck (September 2, 2026), Byron White's voice guide, Client's edits to past posts, and the product as it stands at kickoff.
- The files cover positioning, voice, words to use and avoid, content pillars, what the product does today versus what is in development, approved statistics with their sources, and verbatim third-party quotes.
- Client reviews and signs off on the brand files before the first live run. The engine writes only what these files allow.

### D3. Layout kit

- Up to 15 reusable layouts in the current Club Pilot look, each at Instagram size (1080 × 1350) and LinkedIn size (1200 × 1500). Appendix A lists them.
- Layouts take text and photos as inputs and carry no copy of their own. Colors and type are set in one design tokens file.
- Two layouts switch on only when their inputs exist: the product screenshot layout needs current screenshots from Client, and the Trusted By layout needs the written approved club list.

### D4. Scheduled batches

- Every two weeks the engine delivers 8 to 10 posts across the three channels to Buffer as drafts, each with a proposed date and time, alt text and a first comment.
- The operator receives a summary of each batch with a contact sheet of the images.
- Cadence and batch size can be changed in the configuration file.

### D5. Source mode for Byron's LinkedIn

- Client adds a blog post, article or transcript to the repository, directly or by asking Codex. The engine drafts spin-off posts with images for Byron's LinkedIn and the company channels and delivers them to Buffer as drafts.
- Posts in Byron's voice restate what the source says. They never invent his experiences, opinions or quotes, and every such sentence is checked against the source.
- Source mode does not write blog posts or other long-form content.

### D6. Feedback loop

- Before each batch, the engine reads the copy edits Client made to the previous drafts in Buffer and adds them to its voice reference set, so the next batch is written against Client's revisions.
- A note on a draft that begins with "img:" (for example, "img: use a morning photo") is turned into a re-render. The new image replaces the old one on the same draft, and Client's text edits are kept. Notes are checked daily.
- Corrections Client makes repeatedly are listed in the batch summary as proposed rules. The operator adopts a rule by asking Codex to add it, following the runbook.

### D7. Checks before anything reaches Buffer

- Every post passes these checks before it is rendered or drafted:
  - Product capability: the product is never shown doing something it does not do, and features in development appear only as work in progress.
  - Club names and logos: a real club name or mark appears only if it is on Client's written approved list. Until the list exists, every real club name is blocked. Fictional demo clubs are checked so that none resembles a real club.
  - Numbers: statistics come only from the approved list, with their source.
  - Quotes: third-party quotes match the approved wording exactly.
  - Founder voice: posts in Byron's voice restate a recorded source (D5).
  - Brand voice: words to avoid, sentence case, no em dashes, no single-word headline lines.
  - Variety: no message repeated within 30 days, and no two neighboring posts on the same layout.
  - Humor: humor posts are marked for explicit operator review.
- An automated test suite runs on every change to the repository, so an edit that breaks a layout or weakens a check fails visibly instead of reaching Buffer.
- The checks stop known types of mistakes. They do not judge whether a post is good. Client's review in Buffer is the quality control.

### D8. Photo library

- The existing Club Pilot photo library (87 licensed stock photos, plus the photos, press logos and approved club logos in the current engine) moves into Client's repository, resized for rendering and tagged by subject and orientation, with a usage log so that no photo repeats within 30 days.
- New photos are added by placing them in a folder in the repository or by asking Codex to add them. They are tagged automatically.
- Stock photos stay subject to their source licenses, and the source of each image is recorded.

### D9. Runbook and agent instructions

- One runbook covering how a cycle works (batch, review in Buffer, edit, note, schedule); how the feedback loop works; how to use source mode; how to add photos; how to add a rule; how to add or change a layout; how to change the schedule or pause the engine; what to do when a run fails; how to rotate keys; and the monthly costs in Client's accounts.
- An AGENTS.md file so that Codex, or another coding agent pointed at the repository, follows the same rules as the runbook.

### D10. Training

- One 90-minute working session with the operator, recorded, walking one full cycle live from scheduled run to published post. Aaron is welcome to join.
- One additional 30-minute session on request within the support window.

## 6. Acceptance criteria

The handoff is complete when all of the following are true:

- Two consecutive runs complete in Client's GitHub organization without Consultant intervention, each delivering a full batch to Buffer as drafts with first comments.
- The second run reflects at least one copy edit and one "img:" note that Client left on the first run's drafts.
- One source-mode run turns a blog post or transcript supplied by Client into drafts that pass the founder-voice check.
- A test post naming a real club that is not on the approved list fails the checks and is not rendered.
- The automated test suite passes, and every layout renders at both sizes.
- No Consultant credential remains in the repositories, the GitHub organization, Buffer or the OpenAI account.
- The runbook has been delivered, and the training session has been held and recorded.

Consultant notifies Client by email when the criteria are met. Client confirms acceptance by email within 5 business days. If Client does not respond within that window and has not raised a specific failed criterion, the handoff is deemed accepted and the 30-day support window begins.

## 7. Client dependencies

| Item | Owner | Needed by |
|---|---|---|
| Signed SOW | Byron | Start of work |
| A GitHub organization owned by Client, with Consultant added as a collaborator for the build period | Aaron | Signature plus 3 business days |
| An OpenAI API key on a Client-owned account with billing enabled | Byron | Signature plus 3 business days |
| A new Buffer account owned by Client, on a plan that covers three channels and API access, with an API key | Byron | Signature plus 3 business days |
| Club Pilot Instagram, the Club Pilot LinkedIn company page and Byron's LinkedIn connected to that Buffer account. The Instagram connection currently shows as disconnected and needs an account admin to reauthorize it | Byron | Before the first live run |
| The written approved list of real clubs that may be named or shown. Until it arrives, the checks block every real club name | Heather | Signature plus 5 business days |
| Sign-off on the brand files (D2), including the primary call to action: free trial or book a demo | Byron | 2 business days after delivery |
| Current product screenshots, including the new dashboard | Aaron | Before the product screenshot layout is switched on. Not required for acceptance |
| One blog post or transcript for the source-mode run | Byron | Before the second live run |
| Operator time: about 30 minutes to review each batch in Buffer, plus the training session | Byron | Throughout |

The timeline starts when the first four items are in place. Each business day of delay on any dependency moves acceptance by one business day.

## 8. Costs

Consultant's fee for this work has been agreed separately and is not restated here.

Client's running costs after handoff are paid in Client's own accounts and are Client's responsibility under Section 7 of the Agreement:

- OpenAI API usage: low single-digit dollars per batch at the current batch size.
- Buffer subscription covering three channels and API access.
- GitHub: a private repository and Actions minutes. A two-week cadence typically stays within GitHub's included allowance.
- Image hosting through GitHub: no cost.

The software and AI stack fee in Section 7 of the Agreement covers Consultant's own tools only. It does not cover the items above.

## 9. Transition from the current engine

- The current engine in Consultant's environment stops producing Club Pilot content at signature. No Club Pilot batches are produced between signature and the first live run in Client's accounts.
- Once Client's Buffer account is live, the Club Pilot channels are disconnected from Consultant's Buffer account. Posts already published stay published.
- Three unpublished Club Pilot drafts from August remain in Consultant's Buffer account. They are deleted at cutover unless Client asks to keep them.
- The public image repository Consultant hosts today stays online, unchanged, so that links in past posts keep working.

## 10. License and ownership

This section applies Section 9 of the Agreement to the engine and extends the license so that it survives the engagement.

- Consultant owns the engine. The generation logic, render harness, reusable layout code, checks, feedback system, workflows, and the methods behind them remain Consultant's property.
- Client receives a perpetual license. Consultant grants Client a perpetual, non-exclusive, non-transferable license to use, run and modify the engine for the internal marketing of Club Pilot and Golf Pilot. This license survives termination of the Agreement. It does not permit resale, sublicensing, or offering the engine to any third party as a product or service.
- Client owns everything Club Pilot specific. Brand files, design tokens, logos, the photo library as delivered (subject to the stock licenses), approved lists, the voice reference set, source material, and all generated content are Client's property.
- Modifications are Client's. Changes Client makes after handoff belong to Client.
- Consultant keeps building. Consultant may continue to use and develop the engine for other clients. Client's brand files, voice material, approved lists, strategy and confidential information are never reused.
- Reference and case study. Client permits Consultant to name Club Pilot as a client, describe this engagement, and show published Club Pilot posts and non-confidential results in Consultant's marketing. Consultant will not disclose Client's confidential information. Client may ask in writing for specific items to be left out of future use.

## 11. After handoff: support and maintenance

- 30 days included. For 30 days after acceptance, Consultant fixes anything delivered under this SOW that does not work as described in section 6. Requests by email or Slack, with a response within 2 business days. This covers defects in what was delivered. It does not cover new features, changes Client has made, or operating the engine.
- After the support window, Client operates and maintains the engine. Consultant has no obligation to operate, monitor, maintain or update it. Any further work from Consultant is by separate written agreement.

Drift, stated plainly. Engines like this degrade once they leave the builder's hands. The usual ways: a prompt edited to fix one post breaks three others; a layout change stops rendering; Buffer, OpenAI or GitHub changes and a run fails; a check gets loosened to let one post through and the mistake it prevented comes back. None of this is a defect in what was delivered. The automated test suite and the runbook are there to catch it, and Codex pointed at the repository with the runbook is the intended way to fix it.

## 12. Out of scope

- Operating, monitoring, reviewing or publishing content after acceptance.
- Any guarantee of reach, engagement, followers, leads or sales.
- A web interface, dashboard or editor of any kind.
- A new visual identity, logo or rebrand, and layouts beyond the 15 in Appendix A.
- Video, Reels, Stories or animation.
- Writing blog posts or other long-form content. Source mode works from content Client supplies.
- Channels other than the three in section 2, including Facebook, X, TikTok, Pinterest and YouTube.
- Golf Pilot and Caddy Pilot content.
- Paid ads or boosted posts.
- Replying to comments or direct messages.
- Sourcing new photography or creating product screenshots.
- Securing admin access to social channels, which is Client's responsibility under Section 6 of the Agreement.
- Named testimonials, unless Client supplies written approval for each one. The engine can use them once approved.
- Changes to Club Pilot's website or product.

## 13. Timeline

| Week | What happens |
|---|---|
| Week 0 | Signature. Dependencies in place. Consultant begins the build. |
| Week 1 | Engine, layouts, checks and photo library built. Brand files delivered for sign-off. Dry run reviewed with Client. |
| Week 2 | Engine installed in Client's GitHub organization. First live run delivers a batch to Buffer. Client edits copy and leaves at least one "img:" note. Second live run reflects them. Source-mode run. |
| Week 3 | Training session. Checks tested in front of Client. Acceptance. Consultant credentials removed. 30-day support begins. |

Target: signature by September 30 and dependencies in place by October 5, 2026; acceptance by October 23, 2026.

## 14. Acceptance

By signing below, both parties agree to this statement of work as an addendum to the Agreement.

|  |  |
|---|---|
| Consultant<br>Signature:<br>Travis Enos, d/b/a Applied Intelligence Consulting<br>Date:<br>Email: travis@appliedintelligenceai.co | Client<br>Signature:<br>Byron White, Founder, Golf Pilot, Inc.<br>Date:<br>Email: byron@golfpilot.com |

## Appendix A. Layouts

Each layout renders at Instagram size (1080 × 1350) and LinkedIn size (1200 × 1500). Client may swap layouts in this list during the build as long as the total stays at 15.

| # | Layout | Surface | Notes |
|---|---|---|---|
| 1 | Type card | Light | Headline and short body |
| 2 | Numbered list | Light | Three to six items |
| 3 | Stat card | Light | One approved statistic with its source |
| 4 | Quote card | Light | Byron's words from a source, or a verbatim press quote |
| 5 | Question card | Light | A question for club leaders |
| 6 | Message thread | Dark | Fictional demo club as the sender, with a "powered by Club Pilot" line |
| 7 | Escalation thread | Dark | The assistant hands a question to staff; the post ends at the handoff |
| 8 | Communication hub | Dark | Email, text, app and AI Assist into one inbox |
| 9 | Product screenshot | Dark | Real screenshots only; switched on when Client supplies them |
| 10 | Proof bar | Dark | Press logos; Trusted By club logos only from the approved list |
| 11 | Full-bleed photo | Photo | Headline over a photo |
| 12 | Photo band | Photo | Photo with headline and body below |
| 13 | Photo with thread | Photo | Message thread over a photo |
| 14 | Founder portrait | Photo | Byron, with a line from a source |
| 15 | Carousel | Photo | Cover, inner and closing slides |
