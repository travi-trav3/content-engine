# Format rotation

**Required reading before planning a batch.**

Version 1, Aug 12 2026.

A content pillar is a **subject**. A format is a **shape**. They are independent, and the pipeline kept welding them together: Humor was always a type card, Member experience was always a photograph, Intelligent communication was almost always a phone thread. Nobody decided that. It happened because each new batch copied the last one's pairing, and three batches in, the feed is predictable enough that a reader can tell what a post says before reading it.

Predictable is the problem. Not any single post.

---

## 1. The formats

| Format | What it is |
|---|---|
| `photo` | A photograph carrying the frame, text over or beside it |
| `thread` | A phone or message-thread mockup |
| `type-card` | Typography only, no imagery |
| `data` | A dominant number, stat, or equation |
| `portrait` | A person's photograph with their words |
| `list` | Enumerated or stacked rows |
| `compare` | A split or versus layout |
| `carousel` | Multi-slide, builds to something |
| `logo-wall` | A roster of marks. Frozen until the approved club list lands |
| `diagram` | Channels, steps or systems drawn as connected shapes (the communication hub) |
| `screenshot` | A real product screenshot in a frame. Never drawn UI |

New formats are welcome and expected. Add them here when you build one.

---

## 2. The rules

**Within one batch**

1. A pillar may not use the same format twice. If Intelligent communication runs a thread, its second post that batch is not a thread.
2. No format may account for more than three posts.
3. At least one pillar and format pairing must be one that has never run before.

**Across batches**

4. Two posts running back to back on the same channel should not share a format. This one is a warning, not a hard stop, because dates move and the cost of contorting a calendar to satisfy it is usually higher than the benefit.
5. A pillar that has used the same format in three consecutive batches is flagged. Break it.

Enforced by `rotation-gate.js`, which reads the current batch and every prior batch ledger it is given.

---

## 3. What this looks like in practice

The point is not variety for its own sake. It is that most pillars are better served by a format they have not been using, and nobody finds out while the pairing is on rails.

- **Humor** ran as a type card twice and was never tried as a photograph, even though a photograph is often the funnier choice. A silhouette of someone still swinging in near darkness needs about six words. The type card had to carry everything.
- **Member experience** ran as a photograph four times out of four. It has never been tried as a thread, which is the format that would actually show the member getting the answer rather than describing it afterward.
- **Intelligent communication** ran as a thread four times out of six. It is the pillar most able to carry a list, a comparison, or a number, because it is the one with the most to explain.

When a pillar and a format have never met, that pairing is usually where the batch's best post is.

---

## 4. Ledger field

| Field | Type | Rule |
|---|---|---|
| `format` | string | Required on every post. One of the formats above, or a new one you have added to this file |

`template` stays as it is. It names the specific file that rendered the post. `format` names the shape, so rotation can be reasoned about without reading twelve template names.
