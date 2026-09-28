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
| `--device`, `--device-edge`, `--device-screen`, `--device-header`, `--device-ink`, `--device-muted` | the phone in thread layouts |
| `--avatar-bg`, `--avatar-ink`, `--bubble-out`, `--bubble-in`, `--bubble-ink` | sender avatar and message bubbles |

The brand's `render.json` names the font family and weights the renderer must load, the wordmark file
for each surface, and the brand strings thread layouts need (`thread.channelLabel`,
`thread.poweredBy`, `thread.handoffStatus`). Layouts never hardcode brand words.

## Props

`{ required, maxChars }` is text. `{ type: 'enum', values }` is one of a fixed set.
`{ type: 'list', item: 'text' | { field: spec }, minItems, maxItems }` is a list of text or of objects.
Unknown props and unknown object fields are rejected, so a layout cannot be handed copy it has no place
for (the escalation thread has no prop for anything after the handoff).

## Fitting and render checks

- `data-fit="[80,74,68]"` on a text element: font sizes to try, largest first.
- `data-fit-box` on a container that must not overflow. Each box fits on its own: the fit elements
  inside it step down together until it does not overflow and no checked line in it holds a single
  word. Fit elements outside every box form one more group.
- `data-lines` on text whose lines are checked for single words; `data-lines="orphans"` allows a
  one-line, one-word element (a "Yes" bubble, a short list item) and fails only a wrapped last word.
  Wrap that text with `words()`.
- `base.css` sets `text-wrap: balance` on headlines and `text-wrap: pretty` on checked text, so the
  browser avoids most orphans before the fitter has to shrink anything.

A render reports `render.fontMissing`, `render.imageMissing`, `render.overflow`, `render.offCanvas` and
`render.singleWordLine`. Any of them fails the render.
