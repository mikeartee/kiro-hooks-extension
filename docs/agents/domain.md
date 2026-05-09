# Domain Docs

## Layout: Single-context

This repository uses a single-context layout:

- **`CONTEXT.md`** — at the repo root. Contains the project's domain language, key concepts, and architectural vocabulary. Read this before making any non-trivial change.
- **`docs/adr/`** — Architecture Decision Records at the repo root. Each ADR documents a significant decision, its context, and the rationale.

## Status

Neither `CONTEXT.md` nor `docs/adr/` exists yet. They should be created before running skills that depend on domain context (`diagnose`, `tdd`, `improve-codebase-architecture`, `grill-with-docs`).

## Consumer Rules

- **Always read `CONTEXT.md` first** when starting work in this repo. It defines the authoritative vocabulary — use its terms, not synonyms.
- **Check `docs/adr/`** before proposing architectural changes. If a relevant ADR exists, respect its decision unless you are explicitly revisiting it.
- **Write new ADRs** when a significant architectural decision is made during a session. Place them at `docs/adr/NNNN-<slug>.md` using the next available number.
- **Update `CONTEXT.md`** when new domain concepts are introduced or existing ones are clarified.

## ADR Format

```markdown
# ADR NNNN — Title

**Status:** Proposed | Accepted | Deprecated | Superseded by ADR XXXX  
**Date:** YYYY-MM-DD

## Context
What situation prompted this decision?

## Decision
What was decided?

## Consequences
What are the trade-offs and implications?
```
