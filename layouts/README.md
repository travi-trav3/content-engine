# Layouts

One folder per layout, each with an `index.js` that exports:

```js
module.exports = {
  id: 'type-card',                     // folder name
  title: 'Type card',
  format: 'type-card',                 // rotation format (brand/format-rotation.md); the gates read it
  surfaces: ['dark', 'light'],         // surfaces this layout supports; first is the default
  props: {                             // the only way copy gets in
    headline: { required: true, maxChars: 70 },
    body: { required: false, maxChars: 170 },
  },
  render({ props, brand, surface, photos, slide }) {  // returns the markup inside the 1080 x 1350 canvas
    return `...`;
  },
  check({ props, brand }) { return []; },  // optional: rules that span props or read render.json
  requires: { photoTags: ['...'] },        // optional: assets the brand must have before it can render
};
```

`photos` holds each photo prop resolved from the library (`{ id, src, width, height, tone, focus }`);
draw it with `photo()` from `_shared/h.js`. `slide` is `{ index, total }` when the render is one slide
of a carousel (`engine/render/carousel.js`), and undefined otherwise.

## The fifteen layouts

| # | Layout | Surfaces | For |
|---|---|---|---|
| 1 | `type-card` | dark, light | an idea without a photo |
| 2 | `numbered-list` | light, dark | three to five steps or points |
| 3 | `stat-card` | light, dark | one approved statistic with its source |
| 4 | `quote-card` | light, dark | a recorded quote with attribution |
| 5 | `question-card` | light, dark | a question to the audience |
| 6 | `message-thread` | dark | a member question answered from a club document |
| 7 | `escalation-thread` | dark | a question the assistant hands to staff, ending at the handoff |
| 8 | `communication-hub` | dark | channels meeting in one place |
| 9 | `product-screenshot` | dark, light | a real product screenshot; refuses to render until the library holds one |
| 10 | `proof-bar` | dark | a press line or proof point over logos from the brand's registry |
| 11 | `full-bleed-photo` | photo | a headline over a photo, top or bottom |
| 12 | `photo-band` | dark, light | copy above a photo band; any band-resolution photo |
| 13 | `photo-thread` | photo | the message thread over a photo of club life |
| 14 | `founder-portrait` | dark, light | the founder's point in their words, with a photo tagged `founder` |
| 15 | carousel set: `carousel-cover`, `carousel-step`, `carousel-reveal`, `carousel-close` | cover: dark, light, photo; others: dark, light | a multi-slide post: the hook, steps or stats, the answer, the takeaway (and "try this at your club") |

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
| `--scrim-strong`, `--scrim-mid`, `--scrim-soft`, `--scrim-clear` | gradient stops laid between a photo and type (`.surface-photo`) |

The `photo` surface is for type set over a photograph: white ink, the brand accent, and the scrim stops.
A photo layout lays its own scrim; the brand decides how dark it gets.

The brand's `render.json` names the font family and weights the renderer must load, the wordmark file
for each surface, the brand strings thread layouts need (`thread.channelLabel`, `thread.poweredBy`,
`thread.handoffStatus`), and the proof registry (`proof.labels`, `proof.logos`). Layouts never hardcode
brand words.

Each proof logo records its `relation` (`featured`, `exhibited`, `trusted`), its file per surface, an
optical `height`, and the `basis` for the claim. The proof bar takes its label from the relation, so
copy cannot put an event the brand exhibited at under "As featured in". A `trusted` logo (a customer)
also needs `approval`: who approved it in writing, and when.

## Props

`{ required, maxChars }` is text. `{ type: 'enum', values }` is one of a fixed set.
`{ type: 'list', item: 'text' | { field: spec }, minItems, maxItems }` is a list of text or of objects.
`{ type: 'photo', need, requireTags }` is a photo id from the brand's `photos/library.json`; the renderer
refuses a photo that is not in the library, not reviewed, restricted, below the resolution `need`
asks for (`fullBleed`, `band`), or missing a required tag.
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

- A box overflows when its content is taller or wider than it, or when a child sits outside it: a
  bottom-aligned box overflows upward, which `scrollHeight` alone does not report.
- `photo()` marks its image `data-photo`; a photo shown more than 1.1x its real pixels at the output
  size fails as `render.photoTooSmall`.

A render reports `render.fontMissing`, `render.imageMissing`, `render.photoTooSmall`, `render.overflow`,
`render.offCanvas` and `render.singleWordLine`. Any of them fails the render.

## Carousels

`engine/render/carousel.js` renders 2 to 10 slides as one PNG each. Any layout can be a slide; the
carousel's `surface` applies to every slide that offers it. The carousel set shares `slideFoot()` from
`_shared/h.js`: the position (`02 / 05`) and a swipe cue come from the carousel, never from copy.
`carousel-step` numbers from the first step (`slide.step`), and drops the number on a reveal-flip's
evidence slides (`slide.numbered: false`). Generated carousels are built by
`engine/generate/carousel.js`: cover, inner slides (a step, or a stat card for an approved statistic),
an optional reveal, and a close.

## Test fixtures

`brands/<brand>/test-props/<layout>.json` is a props object, or `{ "slide": {...}, "props": {...} }` for a
layout that shows its carousel position. A layout with `requires` whose assets the brand lacks is tested
for refusal, and its mechanics are checked with a stand-in asset but get no golden.
