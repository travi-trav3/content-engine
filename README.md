# content-engine

Applied Intelligence's social content engine: plans, writes, renders and drafts on-brand posts to
Buffer on a schedule, inside a client's own GitHub, AI and Buffer accounts. Club Pilot is the first
client instance.

This repository is the core and is Applied Intelligence's property. Clients receive a copy of it,
under license, in their own GitHub organization.

## Layout

```
engine/     gates, generation, render, Buffer, Drive, photos, feedback, preflight
layouts/    the layout kit; see layouts/README.md
brands/     brand workspaces; brands/clubpilot is Club Pilot property (see its README)
test/       one suite per area (run on every push)
instance/   the workflows and setup guide a client's repository gets (instance/README.md)
scripts/    make-instance.js: builds or updates a client's repository from this one
internal/   Applied Intelligence only. Plans, SOWs, client notes. Never copied into a client instance.
```

`npm ci && npm test` runs everything CI runs. Working rules for people and coding agents are in
[AGENTS.md](AGENTS.md). The build plan is `internal/PLAN-clubpilot-handoff.md`.

A client's repository: `node scripts/make-instance.js --brand <name> --out <dir>`; later engine
releases with `--update`, which never touches the client's workspace.
