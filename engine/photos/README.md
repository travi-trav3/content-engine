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

## The Drive library (what the reviewer uses)

The reviewer manages photos in a shared Google Drive folder; `drive-sync.js` (the instance's
`photos.yml`, four times a day) makes the library follow:

| Folder | Means |
|---|---|
| Inbox | Drop new photos here. Each is ingested, read by a vision model (`vision.js`: subject, time, people, tags, focus, and any concern), and moved to Active, or to Needs a look if the reading has a concern. Uploading is the reviewer's approval; the reading supplies the tags (`reviewedBy: "vision reading; uploaded by ..."`). |
| Active | In rotation. |
| Parked | Out of rotation until moved back (`parked: true`). |
| Retired | Out for good (`retired: true`). A photo used `drive.retireAfterUses` times (5 for Club Pilot) is moved here by the sync, and so is a duplicate upload. A photo deleted from Drive is retired too. |
| Needs a look | Restricted: a logo that is not the club's, a recognizable face, a real club's name or signage, readable screen text, poor quality, or not a club setting. Moving it to Active is the reviewer's override, recorded in the photo's notes. |
| Briefs | Briefs for `engine/generate/brief.js` (Word, Google Docs as Word, Markdown, text), copied into `briefs/` when new or changed. |
| Suggested | The weekly scout's candidates. Moving one to Active adds it to the library (the move is the approval; the photographer is credited from the file name). A photo dropped straight into Active is added the same way. |
| Rejected | Suggestions turned down; never suggested again. |

Each photo's Drive description says its state, what it shows, its tags and how often it has been used.
The vision reading never adds `founder` or `product-screenshot`; only a person does. Existing photos go
up once with `node engine/photos/drive-sync.js --seed`.

Setup: a Google Cloud service account with the Drive API enabled; its key JSON as the
`GOOGLE_SERVICE_ACCOUNT_JSON` secret; the reviewer shares the root folder with the account's email as an
editor; the folder's id (the last part of its URL) in `config.json` `drive.rootFolderId`. The sync creates
the subfolders.

## The weekly scout

`scout.js` (the instance's `scout.yml`, Monday mornings) counts the photos in rotation for each subject
in `config.json` `scout.subjects`, searches Unsplash with the thinnest subjects' queries, and leaves up to
`scout.perWeek` candidates in Suggested. It never offers an Unsplash+ photo, one under `scout.minWidth`
pixels wide, one already in the library, one suggested or screened before, or one the reviewer
rejected. Each candidate is read by the vision model first: any concern, or a subject other than the one
it was searched for, drops it. At most three readings per suggestion wanted, per run. Every download is
reported to Unsplash, as its API terms require. State is in `photos/scout.json`.

What the scout cannot fix: stock photography of a club's own staff, members, dining room and events reads
as stock. Those subjects are not in the vocabulary and need the club's own photos.

Setup: an Unsplash developer app (demo mode, 50 requests an hour, is enough) and its access key as the
`UNSPLASH_ACCESS_KEY` secret.
