# Task Plan: Kiro Hooks Extension

## Goal

Build a VS Code extension that lets users browse, preview, and install community Kiro hooks
from a GitHub repository directly into their project's `.kiro/hooks/` directory — mirroring
the architecture of the existing `kiro-steering-docs-extension`.

## Approach

Clone the proven pattern from `kiro-steering-docs-extension`. The extension reads a GitHub
repo containing curated hook JSON files, displays them in a tree view in the Kiro sidebar,
and installs selected hooks into the workspace. A companion `kiro-hooks` content repo holds
the actual hook library.

## Steps

- [ ] 1. Write planning docs (this file, findings.md, progress.md)
- [ ] 2. Research existing hook examples and libraries to seed content repo
- [ ] 3. Define hooks content repo structure (categories, schema, metadata)
- [ ] 4. Write the kickoff prompt for building the extension
- [ ] 5. Clone `kiro-hooks-docs` content repo locally and add to workspace
- [ ] 6. Scaffold the extension (package.json, tsconfig, src structure)
- [ ] 7. Implement tree view provider for hooks browser
- [ ] 8. Implement hook installation service (fetch + write to .kiro/hooks/)
- [ ] 9. Implement preview (show hook JSON before installing)
- [ ] 10. Package and publish to open-vsx

## Out of Scope (v1)

- Hook editing or creation UI inside the extension
- Monetisation / premium packs (v2)
- Claude Code skills/subagents distribution (separate product)
- Hook validation beyond JSON schema check
- Auto-update of installed hooks

## Repo Structure

- `mikeartee/kiro-hooks-extension` — the VS Code extension (browser/installer)
- `mikeartee/kiro-hooks-docs` — the hooks content library (actual JSON hook files)

## Open Questions

- What's the minimum viable hook library size before publishing the extension?
- Does the extension need its own categories.json like steering-docs, or can hooks self-describe?
- Exact hook file format: JSON (official UI) vs markdown (kiro.directory examples) — needs verification

