# How private clubs actually operate

**Required Phase 1 reading, above the pillar strategy.** Check every scenario against this file
before writing it. Club professionals spot a false scenario instantly, and no string-matching gate
can catch one: this file is the defense. Every entry has an id; a plan entry whose
`depictsScenario` is true must carry an `operationalCheck` that references one of these ids
(enforced by `plan-gate.js`).

This file grows over time and is the durable asset from the Aug 2026 correction. Add an entry every
time an operational fact is learned or a scenario is corrected. Mark everything unverified as
unverified; never fill a gap with a guess.

## Format

Each entry: `id`, the fact, and `sources`. Byron-sourced entries carry his name and the date.

---

### ops-cart-path
Cart path only is decided the day of play, not in advance. It depends on rainfall, how much of that
rain the ground has absorbed, and current course conditions. A post showing a member asking "are we
cart path only tomorrow" and getting a definitive answer depicts a decision no club has made yet.
`sources: Byron White, Aug 21 2026 feedback ("Cart Path Only decisions are made the day of play, not the day before, dependent on many factors like amount of rain, absorption of that rain, and more")`

### ops-round-ends-18th
A round of golf ends on the 18th hole. Members do not "end a round" at the pro shop counter or the
front desk; a scenario that needs a member standing at a counter after golf must give them a reason
to be there.
`sources: Byron White, Aug 21 2026 feedback ("you don't 'end a round' going to the pro shop... You end the round on the 18th hole")`

### ops-aeration
Aeration is a scheduled seasonal maintenance operation. Its visual signature is a punched, sanded
green; a smooth putting surface contradicts the scenario. Members asking "what happened to the
greens" during aeration week are not failing to read notices; the question becomes relevant the
moment they are standing on the green. Information has a shelf life; answers have a moment.
`sources: Byron White, Aug 21 2026 feedback ("the smooth putting surface should in fact be an aerated green"); doc 01 campaign direction #4; doc 03 sample post 04`

### ops-club-email-opens
Club event emails open at roughly 50 to 70%. Club email is not a failing channel, and no scenario or
stat may imply it is. Generic email-marketing benchmarks (20 to 25% opens) describe a different
industry and do not transfer to private clubs.
`sources: BRAND.md section 8 stat guardrails; Byron White, Aug 21 2026 ("Pulling generic stats and applying them to clubs is not a good idea")`

### ops-buyer-champion
The buyer is almost always the General Manager, sometimes the owner or board. The champion is most
often the communications manager, then the membership or marketing director. The GM answers to a
board; urgency language reads as a red flag to this audience.
`sources: BRAND.md section 1 (compiled from the locked state and Byron's leader conversations)`

### ops-cmaa-pga
CMAA is the confirmed high-close in-person motion. The PGA Show is a credibility and press asset;
the 2026 show is past, so it is evergreen press, not a live event.
`sources: BRAND.md sections 8 and 10`

### ops-competitors-unnamed
Named competitors never appear in content: Clubessential, ForeTees, Clubster, Member Text,
Pacesetter, Jonas, Club Caddie, foreUP. Position by category only.
`sources: BRAND.md never-say list`

### ops-question-timing
Member questions arrive when they become relevant to the member, not when the club communicates the
answer. The member on the course in August did not fail to read the March notice; the notice's
information stopped being reachable at the moment of need. Never frame the member as wrong for
asking, and never frame the club as having failed for sending the notice.
`sources: Byron White, Aug 21 2026 feedback on the aeration post; doc 03 sample post 04 ("Information has a shelf life. Answers have a moment")`

### ops-decision-cadence [unverified pattern, safe floor]
Operational decisions about course conditions (frost delays, cart rules, temporary greens) are made
by superintendents and pro shop staff on the morning of play from same-day conditions. Do not depict
any next-day certainty about course conditions. Specific cadences per decision type are unverified;
ask before depicting one.
`sources: generalized from Byron's Aug 21 cart-path correction; UNVERIFIED beyond cart path`

### ops-seasonality [unverified detail]
Golf is seasonal and "in season" means different months in different regions. Never anchor a
scenario to a month without knowing the region, and never state season-dependent volumes as fact
(the invented "four hundred a week in season" is the cautionary example).
`sources: BRAND.md section 10; D6 postmortem, Aug 26 2026; specifics UNVERIFIED`
