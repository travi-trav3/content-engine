# Buffer: drafts out, the reviewer's changes back

```
node engine/buffer/setup.js                 # print the organization and channel ids for config.json
node engine/buffer/push.js --latest         # draft the newest batch in Buffer
node engine/buffer/push.js --batch 07 --dry-run
node engine/buffer/sync.js                  # read the drafts back and act on what changed
```

In the core repository, prefix with `CE_WORKSPACE=brands/clubpilot`. Tests run everything against an
in-memory Buffer (`--buffer mock`) and assets host (`--assets mock`).

## Push

A batch goes into Buffer as **drafts**, one per post, at its planned time. Nothing is scheduled; the
reviewer schedules a draft to approve it. Each draft has:

- the caption with the engine's CTA line (`postText` in the ledger), and the first comment
- the images, published first to the assets host under content-hashed names
  (`batch-07/b07-03-1a2b3c4d5e.png`) and checked byte for byte before Buffer gets the URL
- alt text on every image
- the tag **Content engine**, which is how sync finds the engine's drafts

Carousels go up as one image per slide on Instagram, and as one PDF (a page per slide) on LinkedIn, so
they swipe there too (`buffer.linkedinCarousel: "images"` sends images instead; LinkedIn shows those as
a grid). Humor carousels end on their takeaway; every other carousel ends on its end card.

A post is not drafted when it did not render clean, fails a gate of its own, its slot has passed, or
its channel has no Buffer channel id yet; the push says which and why. Batch-level gate failures (the
rotation, say) are reported but do not hold the drafts back. The ledger records each draft as it is
made (`post.buffer`), so a second push drafts nothing twice.

## Sync

Every 15 minutes in working hours (the instance's `sync.yml`), sync reads the engine's drafts back and
acts on what the reviewer did:

| In Buffer | What happens |
|---|---|
| A note on a draft | The model reads it against the post: new words, another photo, the other background, another layout, a caption rewrite, or something the engine cannot make. The post is rewritten, gated and rendered, and the new images replace the old **in the same draft**, tagged **Revised**. The photo stays unless the note asks for a new one; the caption stays as it is in Buffer (with any edits) unless the note asks for a caption change. |
| A note asking for what cannot be made (a custom illustration, a photo the library lacks, a claim the capability boundary forbids, a single image turned into a carousel) | Nothing in Buffer changes. The draft is tagged **Needs a look** and the reason goes to the notifier. |
| A note that asks for nothing ("love this") | Recorded; the reviewer is told nothing changed. |
| The caption edited | Recorded as feedback. If the new words trip a gate, the draft is tagged **Check caption** and the rule is named. The reviewer's words are never changed. |
| Scheduled | Recorded as approved, with whether it was edited or revised first. |
| Deleted | Recorded as a rejection. |
| Published, or a publishing error | Recorded; an error is reported. |

Every action goes into `feedback/log.jsonl`. The next batch's planner and writer read a summary of it
(`<reviewer_feedback>`): notes and what they changed, caption edits quoted as what changed, deletes,
and the preferences the notes stated. Preferences that keep recurring belong in the brand files; a
person moves them there.

A note is acted on once. If processing it fails (the model or Buffer is down), the note stays unread
and the next run tries again; after three failures the draft is tagged **Needs a look**.

`buffer.reviewers` limits whose notes count, by email. Leave it empty and any person's note on an
engine draft is acted on; set it once the reviewer's Buffer login is known.

### What a note can change

The words on the image, the photo (from the library), the background (dark, light or photo, as the
layout allows), the layout (any single-image layout except threads), and the caption and first
comment. Not: a custom design or a generated image, a photo the library does not have, adding or
removing a message thread, turning a single image into a carousel or back.

## Limits and cost

- **Buffer**: 100 requests per 15 minutes; 250 a day on Essentials, 500 on Team. A sync with nothing
  new makes one request; one with no open drafts makes none. A push makes one per post plus one for
  tags.
- **GitHub Actions**: each run bills at least a minute. Sync every 15 minutes from 7am to 7pm is about
  1,450 minutes a month; Chromium is installed only on runs where a note needs a new image.
- **OpenAI**: a note costs one reading call and one writing call (more if the revision fails a check).

## Verified, and not yet

Verified against the live API and existing posts (2026-10-01): the endpoint and Bearer key; errors in
the response body; notes are readable on a post and cannot be written by the API; an Instagram
carousel is a post of type `post` with several images; images served from raw.githubusercontent.com
work. Not yet exercised against a live account: a LinkedIn document (PDF) post created through the
API, and Buffer's own normalization of caption text (push records the text as Buffer stored it, so
normalization does not read as an edit). Run 1 against the real account settles both.

## Setup

1. A Buffer organization with the channels connected; an API key (publish.buffer.com/settings/api) as
   `BUFFER_API_KEY`.
2. `node engine/buffer/setup.js` and copy the ids into `config.json` (`buffer.organizationId`,
   `buffer.channels`).
3. A **public** repository for rendered images (Buffer fetches them by URL), named in `assets.repo`,
   and a fine-grained token with contents write on that repository only, as `ASSETS_PUSH_TOKEN`.
4. A Slack incoming webhook as `SLACK_WEBHOOK_URL` (optional; without it messages go to the log).
5. The reviewer's Buffer email in `buffer.reviewers`.
