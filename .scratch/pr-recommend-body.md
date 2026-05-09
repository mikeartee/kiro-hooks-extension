## Summary

Adds workspace-aware hook recommendations to the Kiro Hooks Browser. Users can click "Get Recommendations" (✨) in the tree view title bar or via the command palette to get a ranked list of hooks relevant to their project, select multiple, and install them in one action.

## Slices integrated

In wave order:

- `R1+R7 — Types and WorkspaceAnalyzer` — #12
- `R2 — WorkspaceAnalysisCache` — #13
- `R3+R4 — HookMatcher and RecommendationService` — #14
- `R5+R6 — Recommend command and UI` — #17

Pre-applied (hook tagging):
- `R8 — Tag all hooks in kiro-hooks-docs` — #19 (committed directly to kiro-hooks-docs main)

## What's new

- `WorkspaceAnalyzer` — scans `package.json`, file structure, and `tsconfig.json` to build workspace context (languages, frameworks, dependencies, file patterns, project type)
- `WorkspaceAnalysisCache` — 5-minute TTL cache so repeated recommendation requests don't re-scan the filesystem
- `HookMatcher` — scores hooks against workspace context: framework match (30pts), dependency match (20pts), language match (10pts), event type relevance (10pts)
- `RecommendationService` — orchestrates analysis, scoring, filtering, and ranking
- `kiroHooks.recommend` command — multi-select QuickPick with scored results, bulk install
- "Get Recommendations" button in tree view title bar (✨ sparkle icon)
- 18 unit tests for `HookMatcher`, 4 unit tests for `WorkspaceAnalysisCache`

## Closes

Closes #11
Closes #12
Closes #13
Closes #14
Closes #17
Closes #19

---
Integrated by `/tdd-parallel` across 4 waves.
