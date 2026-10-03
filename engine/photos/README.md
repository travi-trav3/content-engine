# Photo library

Each brand keeps its photos in `photos/` in its workspace: the images, resized and stripped of
metadata, and `photos/library.json`, which records what each photo is and where it may be used. Layouts
never take a file path, only a library id, so a photo nobody has looked at cannot reach a post.

## Adding photos

```
node engine/photos/ingest.js <folder-or-files...> [--license "Where it came from"]
```

Ingest applies EXIF rotation, caps the long edge at 2400px (never upscales), writes `photos/<id>.jpg`,
and measures what a machine can: size, orientation, brightness, which of nine zones are calm enough to
carry text, and whether the resolution holds up full bleed (a 4:5 crop at least 1200px wide) or as a
band (at least 1200px wide). Unsplash filenames are credited automatically; anything else needs
`--license` or a source added in review. Re-running ingest on the same file refreshes its
measurements and keeps its review.

Shoot or buy at 2400px or more on the long edge. Anything under 1200px wide is kept but only offered
where it is shown small.

## Reviewing photos

A new photo is `reviewed: false` and is never selected. Review it with a JSON file:

```
node engine/photos/review.js review.json --by "Your name"
```

```json
{
  "bryce-wendler-ri5g7u0kwpm": {
    "subject": "course", "time": "golden", "people": "none",
    "tags": ["fairway", "long-shadows", "sky-space-top"],
    "focus": { "x": 0.5, "y": 0.5 },
    "notes": ""
  },
  "some-photo": { "restricted": true, "notes": "Third-party logo on the phone screen" }
}
```

- `subject`, `time`, `people` come from a fixed vocabulary (see the top of `review.js`); all three make
  a photo reviewed.
- `tags` are free, but a few have meaning: `founder` (the only photos the founder layout accepts),
  `product-screenshot` (the only images the product layout accepts), `humor-candidate`.
- `focus` is the point the crop keeps in frame, from 0 to 1 across and down.
- `restricted: true` keeps a photo out of every post until someone removes it. Use it for anything with
  a third-party logo, a recognizable person without a release, or a real club's property the club has
  not approved.

## How photos are chosen

`library.select()` offers only reviewed, unrestricted photos with the resolution the layout needs,
skips anything used in the last 30 days or already taken in the batch, and puts the least recently
used first. A use is any earlier post in a batch ledger that carried the photo, on the post's date
(`library.withLedgerUsage()`; a draft the reviewer deleted does not count). `library.recordUse()` is
only for uses outside the engine, such as a photo posted by hand.
