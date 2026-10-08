# Running an instance

The workflows, secrets and setup of a client's own repository. In the core, these files live in
`instance/` and run nowhere; `scripts/make-instance.js` installs the workflows into a client's repository,
set to the client's workspace (`brands/<brand>/`), with this page as `docs/INSTANCE.md`.

| File | What it does |
|---|---|
| `.github/workflows/routine.yml` | Weekday mornings, on the client's ChatGPT subscription: reads new briefs, writes the next two-week batch when the last planned post is under a week away (or finishes one a usage limit stopped), writes open founder posts, then drafts what is ready in Buffer and messages the reviewer with the contact sheet. A morning with nothing due takes a minute and no ChatGPT usage. Run it by hand with "batch now" for an off-cycle batch. |
| `.github/workflows/drafts.yml` | When a change to the content is pushed (Codex revising a post the reviewer asked about): drafts what is ready and updates changed drafts in place, tagged Revised. A caption edited in Buffer is never overwritten. |
| `.github/workflows/founder.yml` | When the founder's material lands in `sources/`: tries again every founder post waiting on material, drafts what is written on the founder's LinkedIn, and asks for what is still missing. Run it by hand with "force" to retry every open slot. |
| `.github/workflows/brief.yml` | When a brief lands in `briefs/`: reads it once, saves the reading beside it, and tells the reviewer what the engine will use and what in it trips a check. |
| `.github/workflows/photos.yml` | Four times a day: follows the reviewer's Drive folders (new photos from Inbox read and put in rotation or Needs a look, moves between Active, Parked, Retired and Needs a look, usage written onto each photo, briefs copied from Briefs and read). Run it by hand with "seed" once, to put the existing library in Drive. |
| `.github/workflows/scout.yml` | Monday mornings: up to eight candidate photos, where the library is thinnest, screened and left in the Drive folder Suggested for the reviewer to move to Active or Rejected. |
| `.github/workflows/sync.yml` | Every 15 minutes, 7am to 7pm Pacific: reads the drafts back from Buffer, revises from notes, records edits, approvals and deletes, commits the ledger and the feedback log. |

Every model call (plans, posts, rewrites, briefs, notes, photo readings, founder posts) is Codex signed
in as the client: no API key, no per-token bill; it draws on the ChatGPT plan's Codex allowance.

The core's `ci.yml` (gate regression suite and golden renders) comes with the copy. Commits made by these
workflows carry `[skip ci]`: they change data (ledgers, plans, brief readings, the feedback log), not code.

## Briefs

The reviewer's monthly content map (or any list of post ideas) goes in the Drive folder's `Briefs`
subfolder, as the Word file or Google Doc it was written in, or straight into `briefs/` in GitHub (Add
file, Upload files). Name it so it sorts by month
(`2026-11-november-map.docx`). Within a few minutes the reviewer gets a message: how many ideas the
engine will use, the weekly themes, and anything in it that trips a check. The next batches draw at
least three in ten posts from it (`brief.minShare`).

## The founder's posts

Founder posts (set in `founder.slots`) go to the founder's own LinkedIn, written only from the founder's
own words. The material goes in the Drive folder's `Sources` subfolder (a voice memo straight from a
phone is the easiest: answer the questions the engine sent, out loud, then add the memo's transcript,
which iPhone Voice Memos shows under each recording, as a note or .txt file; Codex cannot listen to
audio) or in `sources/` in GitHub. A call transcript counts only the founder's turns. When there is not enough
on a topic, the post waits and the founder gets three to five questions; nothing is invented to fill
the gap. Founder drafts are text only. Edit the caption in Buffer, or ask Codex for a change.

## Working with Codex

The client works with the engine in ChatGPT, in Codex, connected to this repository (AGENTS.md, "The
routine and changes in Codex", is what Codex follows):

- "Change the Tuesday post: shorter, and a course photo." Codex runs the change through the same writer
  and gates as a note, commits, pushes; `drafts.yml` swaps it into the draft.
- "Run the routine" or "write the batch now". Codex answers the engine's requests itself and pushes.
- Anything about the brand ("never say X") goes in the brand files, with the date, as AGENTS.md says.

Notes on Buffer drafts still work too (`sync.yml` reads them every 15 minutes and revises with Codex).

## The ChatGPT login

Scheduled runs sign in to Codex as the client. Once, on a computer the client trusts:

1. `npm i -g @openai/codex`, then `codex login` and sign in with the client's ChatGPT account.
2. In this repository: `node engine/codex-auth.js seed`. It writes `codex-auth.enc` (the login,
   encrypted) into the workspace and prints a key once.
3. Add the key as the repository secret `CODEX_AUTH_KEY`; commit `codex-auth.enc`.

Codex refreshes the login as it works; the workflows commit the refreshed copy. If it ever expires (the
reviewer gets a Slack message saying so), repeat the three steps. The file is useless without the key,
but treat both as the client's password, and never make this repository public.

## Secrets (repository settings, Actions)

| Secret | For |
|---|---|
| `CODEX_AUTH_KEY` | Opens `codex-auth.enc`, the client's ChatGPT login for Codex (above). No OpenAI API key is used |
| `BUFFER_API_KEY` | Drafts and read-back (publish.buffer.com/settings/api) |
| `ASSETS_PUSH_TOKEN` | Fine-grained token, contents write on the public assets repository only |
| `SLACK_WEBHOOK_URL` | Optional; where messages to the reviewer go |
| `UNSPLASH_ACCESS_KEY` | The weekly scout's Unsplash developer key |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | The Drive service account's key JSON (engine/photos/README.md, "The Drive library") |

The workflows need `contents: write` on the instance repository (set in each file) to commit back.

## Before the first run

`config.json`: `buffer.organizationId` and `buffer.channels` (from `node engine/buffer/setup.js`),
`buffer.reviewers` (the reviewer's Buffer email), `assets.repo`, `provider` (`{"name": "codex"}`; set
`model` only to pin one), and `founder` (the founder's channel, names as they appear in call transcripts,
posting slots). Then run `node engine/doctor.js` (with the secrets exported) until it says "Ready", run
`routine` by hand with "batch now", and read the drafts in Buffer before the schedule takes over.
