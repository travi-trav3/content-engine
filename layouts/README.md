# Layouts

One folder per layout, each with an `index.js` that exports:

```js
module.exports = {
  id: 'type-card',                     // folder name
  title: 'Type card',
  surfaces: ['dark', 'light'],         // surfaces this layout supports; first is the default
  props: {                             // the only way copy gets in
    headline: { required: true, maxChars: 70 },
    body: { required: false, maxChars: 170 },
  },
  render({ props, brand, surface }) {  // returns the markup inside the 1080 x 1350 canvas
    return `...`;
  },
};
```

## Canvas and sizes

Every layout is drawn on one 1080 x 1350 canvas. The renderer supersamples it to each platform size
(Instagram 1080 x 1350, LinkedIn 1200 x 1500, both 4:5) and downscales with lanczos3. Never write
per-platform pixel values.

## Tokens a layout may use

Set by the brand's `tokens.css`, per surface class (`.surface-dark`, `.surface-light`, ...):

| Variable | Meaning |
|---|---|
| `--bg`, `--bg-raised` | canvas and raised panel backgrounds |
| `--ink` | headline text |
| `--ink-body` | body text |
| `--ink-muted` | captions, sign-offs, attributions |
| `--accent` | emphasized headline text (must pass 3:1 on `--bg` at headline size) |
| `--accent-graphic` | rules, bars, markers (no contrast requirement) |
| `--line` | hairlines |
| `--font-display`, `--font-body`, `--fw-light`, `--fw-body`, `--fw-head`, `--fw-bold` | type |
| `--lh-head`, `--lh-body`, `--ls-display`, `--ls-eyebrow` | type rhythm |
| `--r-md`, `--r-lg`, `--r-bubble`, `--r-pill` | radii |

The brand's `render.json` names the font family and weights the renderer must load, and the wordmark
file for each surface.

## Fitting and render checks

- `data-fit="[80,74,68]"` on a text element: font sizes to try, largest first. All fit elements step
  together until nothing overflows and no line holds a single word.
- `data-fit-box` on the container that must not overflow.
- `data-lines` on text whose lines are checked for single words. Wrap that text with `words()`.

A render reports `render.fontMissing`, `render.imageMissing`, `render.overflow`, `render.offCanvas` and
`render.singleWordLine`. Any of them fails the render.
