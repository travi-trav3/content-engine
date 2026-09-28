# Working in content-engine

Instructions for any coding agent (Codex, Claude, others) and any person changing this repository.

## What this is

The core of Applied Intelligence's social content engine: checks (gates) that stop known failure types,
a renderer that turns a layout plus props into exact-size PNGs, and the layout kit. Clients get a copy of
it in their own GitHub organization. Club Pilot is the first brand and lives here as a fixture.

```
engine/lib/        workspace.js: where brand/ and content/ live (CE_WORKSPACE)
engine/gates/      the checks; check-batch.js runs all of them for one batch
engine/render/     render.js (library), cli.js
layouts/           one folder per layout; _shared/ holds base.css and h.js
brands/<name>/     a brand fixture: brand/, content/, test-props/, goldens/
test/              gates-regression.js, render.test.js, fixtures/
internal/          Applied Intelligence planning material. Never copied into a client instance
```

## Commands

```
npm ci
npm test                                                  # everything CI runs
CE_WORKSPACE=brands/clubpilot node engine/gates/check-batch.js 05
CE_WORKSPACE=brands/clubpilot npm run render -- --layout type-card \
  --props brands/clubpilot/test-props/type-card.json --out /tmp/renders
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
   `render.overflow`, `render.offCanvas` and `render.singleWordLine` are failures, not warnings.
6. **Brand material belongs to its client.** Never copy anything from `brands/<a>/` into `brands/<b>/`
   or into `engine/` or `layouts/`. `internal/` never ships.
7. Commit the render harness and tests with every change. Do not commit `node_modules/` or
   `test/output/`.

## Known gaps

- The gates still embed Club Pilot specifics (pillar names, capability lexicon, banned phrases). Move
  them into brand config before a second brand uses the engine.
- Ledgers in `brands/clubpilot/content/` use the session-era schema (`template`, `format`). Generated
  batches will add `layout` and `surface`; the gates must keep accepting the old fields so the
  regression suite keeps running against the shipped batches.
- Not built yet: generation (OpenAI), photo library, Buffer client, feedback loop, source mode,
  scheduled workflows, layouts 2 to 15.
