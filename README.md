# content-engine

Applied Intelligence's social content engine: plans, writes, renders and drafts on-brand posts to
Buffer on a schedule, inside a client's own GitHub, AI and Buffer accounts. Club Pilot is the first
client instance.

This repository is the core and is Applied Intelligence's property. Clients receive a copy of it,
under license, in their own GitHub organization.

## Layout

```
engine/     gates (checks), render (layout + props to PNG), lib
layouts/    the layout kit; see layouts/README.md
brands/     brand fixtures; brands/clubpilot is Club Pilot property (see its README)
test/       gate regression suite and render tests (run on every push)
internal/   Applied Intelligence only. Plans, SOWs, client notes. Never copied into a client instance.
```

`npm ci && npm test` runs everything CI runs. Working rules for people and coding agents are in
[AGENTS.md](AGENTS.md). The build plan is `internal/PLAN-clubpilot-handoff.md`.
