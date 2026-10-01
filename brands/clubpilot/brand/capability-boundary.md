# Club Pilot AI Assist: capability boundary

**Required Phase 1 reading. Read this before writing a single concept.**

> Trinity describes where the product is going. This file describes what the assistant may be shown
> doing today. Trinity never overrides this file. (Added 2026-08-26.)
>
> This file tells you what the assistant may be shown doing; it is not a content angle. Batch 3
> restated the mechanism it protects nine times because the newest constraint was the most salient
> thing in context. The mechanism belongs in the source and not the output. (Added 2026-08-26.)

Version 2, Aug 12 2026. Verified against the product walkthrough at `clubpilot.com/interactive-demo/complete`.

This file is the single source of truth for what Club Pilot's assistant does. It exists because three posts shipped to review on Aug 6 2026 depicting the assistant booking a court, locating a guest, and rendering unapproved club logos. None of those were copywriting failures. They were the predictable output of a system that had never been told what the product does. A writer asked to demonstrate member value with no stated mechanism reaches for the most vivid member moment, and the most vivid member moments are transactional.

The mechanism must be present in the source material and absent from the output. Not absent from both.

---

## 0. The platform at launch (Club Pilot 2.0, recorded 2026-09-30)

Write as if all four channels are live; the engine launches only when they are. Describe each one the
way Club Pilot's own materials do (the 2.0 home page draft and Byron's LinkedIn About, Sep 2026), and
no further. The AI Assist rules in sections 1 to 9 are unchanged: 2.0 adds channels, it does not give
the assistant new powers.

- **One platform.** Email, Text, Mobile App and AI Assist in one place, with one inbox for staff and
  one communication history for each member. Members choose how they hear from the club. Clubs take
  it on in steps at their own pace, most starting with text and AI Assist (home page draft, Sep 30).
- **Email.** Created and personalized in Club Pilot, two-way (members can reply), with smarter
  targeting, sent from the club's own domain.
- **Text.** Timely notifications, event promotions, reminders, surveys and two-way conversations.
  Members can RSVP to an event by replying to a text; show the club's invitation and the member's
  reply, not the assistant arranging anything.
- **Mobile App.** A club-branded app with AI Assist inside, USGA integration to view and post scores,
  and live chat for members. The home page draft also lists matching members with compatible members
  and hand-selected topics of interest: `[CONFIRM exact behavior with Byron before depicting either]`.
- **AI Assist.** Answers routine questions 24/7 from the documents the club provides, in the club's
  voice, and hands off to staff when a person is needed. It does not book, reserve, pay, order, look
  up live availability or act for anyone (section 3), in any channel. Setup, as the home page draft
  describes it: the club uploads its PDFs, documents and FAQs to its knowledge center; Club Pilot
  makes them ready for the assistant and tunes the voice to the club; the club names its assistant.
  It works in text and inside the app.
- **Live integrations.** None with the tee sheet, reservations, POS or club management software.
  Club Pilot sits beside those systems and hopes to partner with them; posts may say that, and may
  not say it connects to them. USGA scores in the app are the one named integration.

## 1. Mechanism

Club Pilot AI Assist answers member questions from the club's own source-of-truth database, meaning the documents and information the club uploads to the platform. It is a knowledge layer over club information, delivered through the channels members already use.

When it cannot answer from that source, it offers to route the question to club staff, marks the thread for human attention in the club's inbox, and tells the member a person will follow up. A human answers from there.

**It answers what the club has published, and it hands off cleanly what the club has not.**

---

## 2. In scope

Any question whose answer exists in a document a club would upload:

- **Hours and schedules.** Gym, pro shop, dining room, pool, holiday hours
- **Policies and rules.** Dress code, guest policy, cart path rules, pace of play, junior access, pet policy
- **Events and calendar.** What is on this weekend, when the member-guest is, registration deadlines as published, tournament tee-off times as published, closures
- **Facility and amenity information.** Where something is, what it offers, whether it is open
- **Membership and account information the club has published.** Dues schedule, categories, statement timing
- **Menus and dining information.** What is on the menu, whether reservations are required
- **Seasonal and operational notices.** Aeration dates, weather policy, published course conditions

---

## 3. Out of scope

Never depict, imply, or hint at the assistant doing any of these:

- **Booking, reserving, or scheduling anything.** No tee times, courts, dining reservations, lessons, or facility bookings. Not softly, not as a follow-up, not offscreen
- **Transactions.** No payments, charging to accounts, purchases, or ordering
- **Real-time state lookups.** How many tee time slots are open right now, is the court free, is the dining room full. The assistant explicitly does not have this and says so in the product
- **Real-time human or physical tracking.** Has my guest arrived, is my group on the tee, where is the beverage cart
- **Personal assistant tasks performed by the assistant.** Message a person for me, leave a note for the pro, tell the kitchen, hold something
- **Anything requiring live integration** with a tee sheet, point of sale, reservation system, or gate access
- **Speculative future capability** of any kind

---

## 4. The escalation path

**This is a real product capability and content may depict it.** It is also the easiest thing in this document to overreach on.

### What the product does

The Club Pilot inbox is where club staff view, manage, and reply to every message sent to the club. Threads carry a status indicator, and a thread the assistant could not resolve is marked for human attention. The walkthrough shows a thread labeled `Escalate to human`.

The assistant's own language, verbatim from the product:

> "I don't have the exact number of available tee time slots right now. Would you like me to send your question to a staff member for assistance?"

> "Thanks! I'm sending your tee time availability question to MB staff. Someone will get back to you shortly."

A staff member then replies inside the same thread, in their own voice.

### Why this is a strength

An assistant that says "I don't have that" and routes the question is more credible than one that claims to do everything, and it is a better story for an operator worried about a bot embarrassing them in front of a member. The handoff is the trust feature. Do not write it apologetically.

### Depiction rules, all five

1. **The assistant offers, it does not act.** The permitted move is offering to send the question to staff and confirming it was sent. Nothing beyond that
2. **Never show the outcome.** The thread ends at "someone will get back to you shortly." No confirmation, no "you're all set," no booked court, no reserved table, no completed anything
3. **A human closes the loop, and the content says so.** If a resolution is implied at all, it is attributed to a named person at the club, never to the platform
4. **Never claim the assistant triggered a staff action beyond delivery.** It forwards a question and flags a thread. It does not dispatch, assign, task, or instruct anyone
5. **Never claim an unverified notification mechanism.** The verified claim is that staff see it in the inbox and the thread is marked. Not push alerts, not SMS to staff, not "the pro gets pinged"

### The safe pattern

```
Member:    [question the club has not published an answer to]
Assistant: I don't have that one. Want me to send it to the team?
Member:    Yes please
Assistant: Sent. Someone will get back to you shortly.
[end of thread]
```

If a post continues past that last line, it has made a claim the product does not support.

---

## 5. The test

**1. Could this answer be produced by reading a document the club uploaded?** If yes, it ships as a direct answer.

**2. If no, does the post stop at the handoff?** If it stops at "sent, someone will follow up," it ships as an escalation. If it shows the thing getting done, it fails.

Anything that requires looking up live state, taking an action, or moving a human is out, and no rewrite fixes it.

---

## 6. Tone constraint

This boundary is not a limitation to apologize for. A knowledge layer that answers instantly and accurately, in the club's own voice, at 2am, and knows when to get a human, is the product and it is a strong one. **Copy that reads defensive has failed just as surely as copy that overreaches.**

---

## 7. Pillar-level constraints

**Member experience, elevated.** The elevated moment is always the member getting an answer, never the member getting a transaction completed. Angles like "the 9pm text that drives a spring renewal" are legitimate and structurally invite drift, because the vivid version of a member moment is a member getting something done.

**Humor.** The humor is in the question, never in the assistant fulfilling it. If a post depicts the platform completing an absurd request, it has made a product claim inside a joke.

**Front desk leak.** "Front desk" is legitimate when describing the labor problem the product solves. It is illegitimate when describing what the product is. The product is not a front desk and does not staff one.

---

## 8. Ledger fields the gate enforces

| Field | Type | Rule |
|---|---|---|
| `depictsAssistant` | boolean | Required on every post. True if any assistant message or product UI renders |
| `interactionType` | `answer` \| `escalation` | Required when `depictsAssistant` is true |
| `sourceDocument` | string | Required when `interactionType` is `answer`. Names the club document class the answer comes from |
| `endsAtHandoff` | boolean | Required when `interactionType` is `escalation`. Must be true |
| `capabilityClearedBy` | string | Reviewer name. Only clears blocked terms inside a valid escalation post |
| `clubMarks` | array | Every real club name, logo, monogram, crest, or wordmark rendered. Empty array if none. Every entry must appear in `approved-clubs.json` |

Enforced by `capability-gate.js`. A missing attestation is a hard fail, not a default.

---

## 9. Words that need judgment, not a rule

**"Concierge"** is defensible as a category descriptor. Check every instance for whether it implies a concierge's actions rather than a concierge's knowledge.

**"Assistant"** is fine. **"Receptionist"** and **"personal assistant"** are not. Byron ruled both out on Aug 6.

**"The smartest front desk you never had to hire"** is a recorded secondary positioning line and it is on hold. It frames the product as a front-desk replacement, which is the framing Byron ruled out. Do not use it until Byron decides.
