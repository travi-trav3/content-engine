# Working in content-engine

Instructions for any coding agent (Codex, Claude, others) and any person changing this repository.

## What this is

The core of Applied Intelligence's social content engine: checks (gates) that stop known failure types,
a renderer that turns a layout plus props into exact-size PNGs, and the layout kit. Clients get a copy of
it in their own GitHub organization. Club Pilot is the first brand and lives here as a fixture.

```
engine/lib/        workspace.js: where brand/ and content/ live (CE_WORKSPACE)
engine/gates/      the checks; check-batch.js runs all of them for one batch
engine/generate/   plan, write, gate, render a batch (batch.js); brief.js (the reviewer's briefs); providers/; see its README
engine/render/     render.js (library), cli.js, carousel.js, contact-sheet.js, pdf.js (LinkedIn carousels)
engine/photos/     library.js, ingest.js, review.js, vision.js, drive-sync.js, scout.js, unsplash.js; see its README
engine/drive/      client.js (Drive API v3, service account), mock.js
engine/buffer/     client.js, mock.js, push.js (drafts), sync.js (notes, edits, approvals); see its README
engine/feedback/   revise.js (a note becomes a new version), log.js (feedback/log.jsonl and its summary)
engine/publish/    host.js: renders to the public assets repository, content-hashed and verified
engine/notify.js   messages to the reviewer (Slack webhook or console)
engine/doctor.js   the preflight: every key, channel and permission a live run needs, each failure with its fix
instance/          files only a client instance gets: the batch and sync workflows
layouts/           one folder per layout; _shared/ holds base.css, h.js and thread.js
brands/<name>/     a brand fixture: brand/, content/, photos/, test-props/, goldens/
test/              gates-regression.js, photos.test.js, render.test.js, generate.test.js, buffer.test.js, fixtures/
internal/          Applied Intelligence planning material. Never copied into a client instance
```

## Commands

```
npm ci
npm test                                                  # everything CI runs
CE_WORKSPACE=brands/clubpilot node engine/gates/check-batch.js 05
CE_WORKSPACE=brands/clubpilot npm run generate -- --plan-only          # needs OPENAI_API_KEY
CE_WORKSPACE=brands/clubpilot npm run generate -- --provider mock --mock-dir test/fixtures/generate/clubpilot --start 2026-10-05
CE_WORKSPACE=brands/clubpilot npm run push -- --batch 06 --dry-run              # what would go to Buffer
CE_WORKSPACE=brands/clubpilot node engine/generate/brief.js                   # read briefs, print their checks
BUFFER_API_KEY=... node engine/buffer/setup.js                                 # organization and channel ids
node engine/doctor.js [--offline] [--slack-test]                               # is this instance ready to run live?
CE_WORKSPACE=brands/clubpilot node engine/photos/drive-sync.js --drive mock --seed  # the Drive sync, dry
CE_WORKSPACE=brands/clubpilot npm run render -- --layout type-card \
  --props brands/clubpilot/test-props/type-card.json --out /tmp/renders
CE_WORKSPACE=brands/clubpilot npm run render:carousel -- --spec carousel.json --out /tmp/renders
CE_WORKSPACE=brands/clubpilot npm run photos:ingest -- ~/Downloads/new-photos
CE_WORKSPACE=brands/clubpilot npm run photos:review -- review.json --by "Name"
node engine/render/contact-sheet.js --out sheet.png /tmp/renders/*.png   # look before you commit
```

In a client instance `brand/` and `content/` sit at the repository root and `CE_WORKSPACE` is unset.

Chromium is the build pinned by `playwright-core` in package.json. CI installs it with
`npx playwright-core install --with-deps chromium`. In a cloud sandbox that preinstalls browsers under
`PLAYWRIGHT_BROWSERS_PATH`, do not run any install command; the pinned build is already there.

## Rules

1. **Never loosen a gate to let a post through.** Each rule exists because a post shipped with that
   defect. Change gate behavior only with a regression case in `test/gates-regression.js` that shows
   the old failure still fails. Every expectation in that file must hold.
2. **Layouts carry no copy.** All text arrives as props and passes through `words()` or `esc()` from
   `layouts/_shared/h.js`. Sample copy in a template is how the Aug 6 capability overreach got rendered.
3. **Layouts use only the semantic tokens** (`--bg`, `--ink`, `--ink-body`, `--ink-muted`, `--accent`,
   `--accent-graphic`, `--line`, type and shape variables). Never a brand hex. See `layouts/README.md`.
4. **A layout is not done until it has** a `test-props/<layout>.json` fixture, renders clean on every
   surface it declares at both sizes, and has goldens. Update goldens only for an intended visual change
   (`UPDATE_GOLDENS=1 npm run test:render`), and look at every changed image before committing.
5. **A render with issues does not ship.** `render.fontMissing`, `render.imageMissing`,
   `render.photoTooSmall`, `render.overflow`, `render.offCanvas` and `render.singleWordLine` are
   failures, not warnings.
6. **Photos come only from the reviewed library.** Layouts take a library id, never a path. Never mark a
   photo reviewed without looking at it, and never lift a restriction without the reason in its notes
   being resolved. The one automated review: a photo the reviewer uploads to the Drive Inbox is reviewed
   by the vision reading when the reading has no concern; any concern keeps it restricted until a person
   moves it to Active. Never draw product UI; a product image is a real screenshot tagged
   `product-screenshot`.
7. **Proof logos come only from the registry** in `render.json`, with the relation that is true. A
   customer logo (`trusted`) needs the written approval recorded in its entry before it is added.
8. **Generation never approves or publishes.** A generated plan records `review: "buffer-drafts"` (every
   post goes to Buffer as a draft for Byron) or waits for a person's `approvedBy`. Never write a name
   into `approvedBy` from code. Humor is generated only as a Buffer draft Byron approves. Push creates
   drafts only (`saveToDraft`); nothing in the engine schedules a post. Scheduling a draft in Buffer is
   the approval, and sync records it as Buffer status, never as `approvedBy`.
9. **The reviewer's words are theirs.** Sync never rewrites a caption the reviewer edited; a caption
   edit that trips a gate is tagged and reported. A note changes a post only through the writer, the
   gates and the renderer, like any other revision; what cannot be made is reported, never guessed at.
10. **Brand material belongs to its client.** Never copy anything from `brands/<a>/` into `brands/<b>/`
   or into `engine/` or `layouts/`. `internal/` never ships.
11. Commit the render harness and tests with every change. Do not commit `node_modules/` or
   `test/output/`.

## Known gaps

- The gates still embed Club Pilot specifics (pillar names, capability lexicon, banned phrases). Move
  them into brand config before a second brand uses the engine.
- Ledgers in `brands/clubpilot/content/` use the session-era schema (`template`, `format`). Generated
  batches will add `layout` and `surface`; the gates must keep accepting the old fields so the
  regression suite keeps running against the shipped batches.
- Not built yet: source mode (founder posts from material Byron supplies) and the brand-update inbox.
- The Drive sync, the vision reading and the scout are tested against an in-memory Drive, a recorded
  Unsplash and recorded readings, not yet against the live services.
- A brief's reading (`briefs/<name>.json`) is the model's; it can misplace an idea's week or channel.
  The October map gives no week per Instagram idea, so its reading places them three a week in order.
- Not yet exercised against a live Buffer account: a LinkedIn document (PDF) post created through the
  API, and Buffer's own normalization of caption text. Run 1 settles both (engine/buffer/README.md).
- A note cannot turn a single image into a carousel or back, or add or remove a message thread; it
  says so and tags the draft. Lessons from notes stay in the feedback log until a person moves them
  into the brand files.
- The full-bleed layout darkens the wordmark corner from the photo's measured top zones, which are
  measured on the whole photo; a landscape photo cropped to 4:5 shows its middle. Measure the crop
  instead when a render shows a weak wordmark.
- Goldens are lossless WebP, about 10 MB for Club Pilot. Every intended visual change adds a changed
  golden to history; batch visual changes rather than regenerating goldens for each small tweak.
