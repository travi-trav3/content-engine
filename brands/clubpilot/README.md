# Club Pilot fixture

Club Pilot (Golf Pilot, Inc.) property: brand files, tokens, fonts, wordmarks, ledgers, test props and
goldens. It lives here as the first brand while the engine is built, and moves into Club Pilot's own
repository at handoff. It is removed from this repository before the engine is used for any other client.

- `brand/` is the session-era brand bible, rules and approved lists, plus `tokens.css` and `render.json`
  for the layout kit. BRAND.md and the capability boundary are rewritten to the September 2026
  positioning during the build.
- `content/batch-01` to `batch-05` are the shipped batches. The gate regression suite runs against them.
- `photos/` is the photo library (77 reviewed photos) and `photos/README.md` its state, what is missing,
  and the shot list for the new positioning.
- `render.json` `proof` registers Golf Digest and Golf Bizz Review as `featured` and the PGA Show as
  `exhibited`, per BRAND.md section 8. CMAA is not registered: BRAND.md names it as an industry
  association and sales channel, not as press, so there is no true label for it yet. The customer club
  logos are not registered either: BRAND.md contradicts itself on their approval (the 2026-07-24 live
  override says approved, section 8 says still gated), and the files on hand are about 150px with opaque
  black backgrounds. Each needs a transparent high-resolution file and its approval recorded.
- The light surface in `tokens.css` and `assets/wordmark-on-light.svg` are provisional and need Byron's
  sign-off. The on-light wordmark is the on-dark file with the white letters recolored to canvas ink.
- `render.json` `thread.handoffStatus` ("Marked for the club team") is also provisional. It must stay
  within the capability boundary's verified claim: staff see the question in the inbox and the thread
  is marked. No push alerts, no texts to staff.
