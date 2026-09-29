# Club Pilot photo library

Club Pilot (Golf Pilot, Inc.) property. 77 photos, all reviewed (initial pass by Claude from contact
sheets, 2026-09-29; Byron or Aaron should skim the tags and restrictions once). How the library works:
`engine/photos/README.md`.

## What is here

| | |
|---|---|
| Subjects | golfer 15, golf detail 13, course 12, aerial course 8, marina 5, tennis 5, yacht 4, aerial marina 3, golfers 2, clubhouse 2, phone 2, range 2, grounds 1, carts 1, pickleball 1, portrait 1 |
| Time of day | day 56, golden 11, dusk 6, dawn 2, night 2 |
| Resolution | 71 hold up full bleed, 76 as a band |
| Sources | 76 from Unsplash (Unsplash License, credited in `library.json`); Byron's headshot |

**Restricted** (never selected until someone lifts it):
- `cardmapr-nl-au-tyt7e0lw`: a third-party map app on the phone screen; it would read as Club Pilot's
  product.
- `cristina-anne-costello-kazsutdalb0`: a First Tee flag. Usable only if confirmed or cropped.

**Never name the place:** `johnny-such-xhqahufdq1e`, `noah-rosenfield-njaglwiohcm` (courses that may be
recognizable) and `maciej-marko-s72kiq39c54` (resort signage). Fine as scenery, never implied to be a
client.

**Founder:** `byron-white-founder` is 389 x 389, the only headshot available. It works as the small
circle in the founder layout and nowhere larger. Needed from Byron: the original file, a color version,
and two or three environmental portraits.

## Not yet in the library

Eleven photos in the Drive folder "Photography: Club Pilot" could not be transferred (6 to 15 MB each,
over what the Drive connector moves). Download them to any folder, then run
`CE_WORKSPACE=brands/clubpilot node engine/photos/ingest.js <folder>` and review them:

patrick-nguyen-_FSKZoMVDQM, zoshua-colah-Tw1dYTSPSpI, anna-rosar-ZxFyVBHMK-c,
frames-for-your-heart-_VkLAnEOeKs, toa-heftiba-BCZoKs18pCA, bryce-wendler-FUET-ScYZfk,
bryce-wendler-GN2_-YMeNL4, bryce-wendler-emPraEVIh-E, tom-moser-F1_SdW1W93Y,
satchymo-photos-mlpYtVy8iOM, bernd-dittrich-qEGGMJdyrRA

## The gap: this is a golf library, and the story is club communication

Two thirds of the library is golf courses and golfers. The positioning is member communication across a
whole club: members getting the right information on the channel they choose, and staff no longer
answering the same question by phone. The library has no staff, no dining or events, no clubhouse
interiors, no pool or fitness, and two photos of a phone in someone's hand. Every post about staff,
events or dining will fall back to a type card until that changes.

Shot list, about 40 photos, in priority order:

1. **Members with phones in club life (10).** Between shots on the course, on the dock, poolside, in
   the grill room, in a golf cart. Natural, not selfies. Screens turned away or dark: the engine never
   shows invented product UI.
2. **Staff at work (8).** Front desk or member services, pro shop counter, a starter at the first tee,
   a dock master, a GM at a desk, a server. The people Club Pilot takes the repeat calls off.
3. **Clubhouse, dining and events (8).** Grill room, dining room set for dinner, locker room, a club
   dinner, a junior clinic, a tennis social, a member-guest.
4. **The operations the posts talk about (6).** Frost on a fairway at dawn, a cart-path-only sign,
   aeration, a rain delay, the range with ball baskets, a posted course closure.
5. **Seasons (4).** Autumn and winter at a club; the calendar drives half the content.
6. **Founder (4).** A high-resolution headshot and environmental portraits of Byron at a club and on
   stage or at a booth.

For every photo: at least 2400px on the long edge (camera originals preferred), a calm third of the
frame (sky, lawn, wall) where a headline can sit, no third-party logos or brand names, no real club
signage unless the club has approved it in writing, and a signed release for anyone recognizable.

Stock covers courses and landscapes well. It does not cover staff and interiors: stock "front desk"
photos read as hotels. One half-day shoot at a client club, with releases, would fill sections 1 to 3
better than any stock search.

## Product screenshots

`product-screenshot` renders only from images tagged `product-screenshot`, and there are none. Needed
from the product team: real phone captures at native resolution (for example 1179 x 2556) and desktop
inbox captures at 2x, populated with the fictional demo clubs from `brand/demo-clubs.json`, never a real
club's data. Ingest them like photos and tag them in review.
