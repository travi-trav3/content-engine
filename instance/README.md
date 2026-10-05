# Running an instance

The workflows, secrets and setup of a client's own repository. In the core, these files live in
`instance/` and run nowhere; `scripts/make-instance.js` installs the workflows into a client's repository,
set to the client's workspace (`brands/<brand>/`), with this page as `docs/INSTANCE.md`.

| File | What it does |
|---|---|
| `.github/workflows/batch.yml` | Monday mornings: when the last planned post is under a week away, generates the next two-week batch, drafts it in Buffer, commits it, and messages the reviewer with the contact sheet. Run it by hand with "force" for an off-cycle batch. |
| `.github/workflows/founder.yml` | When the founder's material lands in `sources/`: tries again every founder post waiting on material, drafts what is written on the founder's LinkedIn, and asks for what is still missing. Run it by hand with "force" to retry every open slot. |
| `.github/workflows/brief.yml` | When a brief lands in `briefs/`: reads it once, saves the reading beside it, and tells the reviewer what the engine will use and what in it trips a check. |
| `.github/workflows/photos.yml` | Four times a day: follows the reviewer's Drive folders (new photos from Inbox read and put in rotation or Needs a look, moves between Active, Parked, Retired and Needs a look, usage written onto each photo, briefs copied from Briefs and read). Run it by hand with "seed" once, to put the existing library in Drive. |
| `.github/workflows/scout.yml` | Monday mornings: up to eight candidate photos, where the library is thinnest, screened and left in the Drive folder Suggested for the reviewer to move to Active or Rejected. |
| `.github/workflows/sync.yml` | Every 15 minutes, 7am to 7pm Pacific: reads the drafts back from Buffer, revises from notes, records edits, approvals and deletes, commits the ledger and the feedback log. |

The core's `ci.yml` (gate regression suite and golden renders) comes with the copy. Commits made by these
workflows carry `[skip ci]`: they change data (ledgers, plans, brief readings, the feedback log), not code.

## Briefs

The reviewer's monthly content map (or any list of post ideas) goes in the Drive folder's `Briefs`
subfolder, as the Word file or Google Doc it was written in, or straight into `briefs/` in GitHub (Add
file, Upload files). Name it so it sorts by month
(`2026-11-november-map.docx`). Within a few minutes the reviewer gets a message: how many ideas the
engine will use, the weekly themes, and anything in it that trips a check. The next batches draw at
least three in ten posts from it.

## The founder's posts

Two founder posts a batch (Tuesdays) go to the founder's own LinkedIn, written only from the founder's
own words. The material goes in the Drive folder's `Sources` subfolder (a voice memo straight from a
phone is the easiest: answer the questions the engine sent, out loud) or in `sources/` in GitHub. A
memo is transcribed once; a call transcript counts only the founder's turns. When there is not enough
on a topic, the post waits and the founder gets three to five questions; nothing is invented to fill
the gap. Founder drafts are text only. Edit the caption in Buffer, or leave a note to have it rewritten
from the same material.

## Secrets (repository settings, Actions)

| Secret | For |
|---|---|
| `OPENAI_API_KEY` | Planning, writing, and reading notes |
| `BUFFER_API_KEY` | Drafts and read-back (publish.buffer.com/settings/api) |
| `ASSETS_PUSH_TOKEN` | Fine-grained token, contents write on the public assets repository only |
| `SLACK_WEBHOOK_URL` | Optional; where messages to the reviewer go |
| `UNSPLASH_ACCESS_KEY` | The weekly scout's Unsplash developer key |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | The Drive service account's key JSON (engine/photos/README.md, "The Drive library") |

The workflows need `contents: write` on the instance repository (set in each file) to commit back.

## Before the first run

`config.json`: `buffer.organizationId` and `buffer.channels` (from `node engine/buffer/setup.js`),
`buffer.reviewers` (the reviewer's Buffer email), `assets.repo`, the model name under `provider`, and
`founder` (the founder's channel, names as they appear in call transcripts, posting slots).
Then run `node engine/doctor.js` (with the secrets exported) until it says "Ready", run `batch` by hand
with "force", and read the drafts in Buffer before the schedule takes over.
