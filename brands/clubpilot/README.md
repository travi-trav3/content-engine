# Club Pilot fixture

Club Pilot (Golf Pilot, Inc.) property: brand files, tokens, fonts, wordmarks, ledgers, test props and
goldens. It lives here as the first brand while the engine is built, and moves into Club Pilot's own
repository at handoff. It is removed from this repository before the engine is used for any other client.

- `brand/` is the session-era brand bible, rules and approved lists, plus `tokens.css` and `render.json`
  for the layout kit. BRAND.md and the capability boundary are rewritten to the September 2026
  positioning during the build.
- `content/batch-01` to `batch-05` are the shipped batches. The gate regression suite runs against them.
- The light surface in `tokens.css` and `assets/wordmark-on-light.svg` are provisional and need Byron's
  sign-off. The on-light wordmark is the on-dark file with the white letters recolored to canvas ink.
