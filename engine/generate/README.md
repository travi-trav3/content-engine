# Generation

Turns the brand files, the photo library and the calendar into a batch of finished, gated, rendered
posts. Nothing here schedules or publishes; the batch ends as drafts for a person to review.

```
node engine/generate/batch.js                         # the next batch, with the provider in config.json
node engine/generate/batch.js --start 2026-10-05      # a batch starting on a given Monday
node engine/generate/batch.js --plan-only             # stop after the plan
node engine/generate/batch.js --provider mock --mock-dir test/fixtures/generate/clubpilot   # no API key
```

In the core repository, prefix with `CE_WORKSPACE=brands/clubpilot`.

## What a run does

1. **Plan** (`plan.js`). The model fills each slot of the calendar with a pillar, a territory, one
   plain-sentence message, a layout, and the attestations the gates need. The plan gate, the rotation
   rules and the engine's own checks (layout fits the surface, thread layouts name a unique demo club,
   the library has the photos the plan asks for) run on it. Failures go back to the model, quoted, for
   a full revision, up to `maxRevisions.plan` times.
2. **Write** (`write.js`). One call per post. The model fills the layout's props against a strict
   schema built from the layout, plus the caption, first comment, alt text and earns-its-place line,
   and asks for a photo by subject, time of day and tags. The engine picks the least recently used
   photo that fits (relaxing tags, then people, then time, never the subject), fills the thread
   sender from the plan, and validates everything the renderer would refuse.
3. **Gates and render** (`batch.js`). Every ledger gate runs. A post that fails a gate, or renders with
   an issue (copy that does not fit, a lone word on a line), goes back to the writer with the finding,
   up to `maxRevisions.post` times. What still fails is listed in the report for a person.
4. **Record.** `content/batch-NN/` gets `plan.json`, `ledger.json`, `report.md` and
   `contact-sheet.jpg`. Renders go to `.staging/batch-NN/`, which is not committed; publishing them and
   drafting them in Buffer are the next steps.

## Review

`config.json` `review` decides where a person approves:

- `buffer-drafts` (default): the plan records that nobody has approved it yet, and every post goes to
  Buffer as a draft that a person reads, edits and schedules. Nothing publishes without that.
- `plan-approval`: the run stops after the plan. A person fills `approvedBy` on each entry, then the
  batch is generated from the approved plan.

Humor is never generated automatically: the editorial gate requires a named approver for every Humor
post, so `excludePillars` keeps it out of automated batches.

## What the model is given

Every prompt opens with the brand files (BRAND.md, the capability boundary, the editorial standard,
the operations facts, format rotation, the voice reference, approved stats, demo clubs, approved
clubs) in the same order, so the provider can cache that part. Then the history of the last 60 days,
what the photo library can supply, and the layouts available to this brand. Layouts are left out when
the brand lacks what they need (the product screenshot until a real screenshot is in the library),
when they need a source (founder portrait and quote card belong to source mode), or when
`excludeLayouts` turns them off.

## Calls to action

`cta.every` sets how often a post asks (4: one post in four, rounded either way per batch). The plan
gate refuses more than that and any two asks in a row on one channel; the engine also refuses fewer.
Which line each asking post gets is the engine's decision, not the model's: the least recently used
variant from `cta.variants`, never the same one twice in a batch, in the channel's form (LinkedIn
carries the link, Instagram points to the bio). The engine adds it as the caption's last line
(`postText` in the ledger is what Buffer receives). A caption the model writes with its own link,
"link in bio" or sales language is sent back. Edit the variants to change the voice of the asks; the
library is checked for dashes, exclamation marks and sales words on every run.

## Providers

`providers/openai.js` calls the OpenAI Responses API with a strict JSON schema, retries rate limits
and server errors, and reads the key from the environment variable in `config.json`
(`OPENAI_API_KEY`). `providers/mock.js` answers from recorded responses and is what the tests use. A
new provider is one file that implements `generate({ key, system, user, schema, schemaName })` and
returns `{ data, usage }`.

The model in `config.json` is a starting value. Confirm it against the models available on the
account when the key is set up, and run one batch with `--plan-only` first.

## Config

```json
{
  "timezone": "America/Los_Angeles",
  "review": "buffer-drafts",
  "provider": { "name": "openai", "model": "...", "apiKeyEnv": "OPENAI_API_KEY", "reasoningEffort": "medium" },
  "cadence": { "batchDays": 14, "slots": [ { "dayOfBatch": 0, "time": "08:35", "channel": "linkedin_page" } ] },
  "channels": { "instagram": { "size": "ig" }, "linkedin_page": { "size": "li" } },
  "cta": { "every": 4, "type": "demo", "link": "https://...", "variants": [ { "id": "...", "linkedin": "... https://...", "instagram": "... Link in bio." } ] },
  "excludePillars": ["Humor"],
  "excludeLayouts": [],
  "maxRevisions": { "plan": 3, "post": 2 }
}
```

A slot names a `day` (every week) or a `dayOfBatch` (0 is the first Monday). The plan gate requires
LinkedIn to carry at least half of every batch; set the cadence so it does.
