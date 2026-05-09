# PRD: Hook Recommendations — workspace-aware hook discovery

## Problem

Users browsing the Kiro Hooks Browser see a flat list of all available hooks with no guidance on which ones are relevant to their project. A TypeScript developer has to manually scan through hooks for Python, Go, and other ecosystems to find the ones that apply to them. There is no way to discover hooks based on what the workspace actually contains.

The hooks in `kiro-hooks-docs` also have empty `tags` arrays, meaning even if a scoring system existed, it would have nothing to match against.

## Goals

- Users can click "Get Recommendations" and see a ranked list of hooks relevant to their workspace in under 3 seconds
- Hooks are scored based on workspace signals: detected languages, frameworks, dependencies, file patterns, and project type
- Users can select multiple recommended hooks and install them in one action
- Workspace analysis is cached so repeated recommendation requests within a session don't re-scan the filesystem
- All 14 hooks in `kiro-hooks-docs` have meaningful `tags` values so scoring produces useful results

## Out of scope

- A webview panel for hook details (QuickPick is sufficient)
- Recommendations based on what other users have installed
- Automatic installation without user confirmation
- Recommendations for hooks already installed (filtered out by default)

## Work items

### Core services (kiro-hooks-extension)

- [ ] **R1 — WorkspaceAnalyzer** — Scans the workspace to build a `WorkspaceContext`: reads `package.json` for dependencies and frameworks, scans file structure for patterns (components, routes, tests), detects languages from `tsconfig.json`, classifies project type (web-app, api-server, cli-tool, vscode-extension, library, unknown)
- [ ] **R2 — WorkspaceAnalysisCache** — TTL-based in-memory cache (5 min default) wrapping `WorkspaceAnalyzer`. Returns cached result on repeated calls within the TTL window. Cache is invalidated on `kiroHooks.refresh`.
- [ ] **R3 — HookMatcher** — Scores a `HookMetadata` against a `WorkspaceContext` using weighted signals: tag-to-framework (30pts), tag-to-dependency (20pts), tag-to-file-pattern (15pts), tag-to-language (10pts), eventType relevance (10pts). Returns a `ScoredHook` with score and match reasons.
- [ ] **R4 — RecommendationService** — Orchestrates: analyze workspace (via cache), fetch hook list, score all hooks via `HookMatcher`, filter by min score (default 10), exclude already-installed hooks, return top N results sorted by score.

### Command and UI (kiro-hooks-extension)

- [ ] **R5 — `kiroHooks.recommend` command** — Triggers recommendation flow: shows progress notification during analysis, presents results in a multi-select QuickPick (label = hook name, description = top match reason, detail = hook description), bulk-installs selected hooks, refreshes tree.
- [ ] **R6 — Tree view title bar button** — Add "Get Recommendations" button (sparkle icon `$(sparkle)`) to the `kiroHooksView` title bar alongside Refresh and Check Updates.
- [ ] **R7 — Types** — Add `WorkspaceContext`, `ScoredHook`, `MatchReason`, `ProjectType`, `FrameworkInfo`, `DependencyInfo`, `FilePattern`, `SCORING_WEIGHTS` to `src/models/types.ts`.

### Hook tagging (kiro-hooks-docs)

- [ ] **R8 — Tag all hooks** — Update `tags` arrays in all 14 hook JSON files with meaningful values:
  - `lint-on-save.json` → `["typescript", "javascript", "eslint", "linting"]`
  - `markdown-lint.json` → `["markdown", "documentation", "linting"]`
  - `python-lint-on-save.json` → `["python", "linting", "ruff", "flake8"]`
  - `run-tests-after-task.json` → `["testing", "ci", "automation"]`
  - `generate-test-skeleton.json` → `["testing", "typescript", "javascript"]`
  - `update-tests-on-source-change.json` → `["testing", "typescript", "javascript", "python"]`
  - `barrel-export-update.json` → `["typescript", "javascript", "modules"]`
  - `sync-api-docs.json` → `["documentation", "api", "typescript", "javascript"]`
  - `scan-for-secrets.json` → `["security", "secrets", "credentials"]`
  - `pre-commit-review.json` → `["workflow", "git", "code-review"]`
  - `cleanup-dead-imports.json` → `["typescript", "javascript", "maintenance", "imports"]`
  - `dependency-audit.json` → `["security", "dependencies", "npm", "maintenance"]`
  - `env-example-sync.json` → `["maintenance", "environment", "configuration"]`
  - `lockfile-sync-check.json` → `["maintenance", "npm", "dependencies"]`

## Acceptance criteria

- Clicking "Get Recommendations" on a TypeScript project with ESLint shows `lint-on-save` and `update-tests-on-source-change` in the top results
- Clicking "Get Recommendations" on a Python project shows `python-lint-on-save` in the top results
- A project with no `package.json` and no recognisable signals still shows the command without crashing (returns empty list with a friendly message)
- Selecting multiple hooks in the QuickPick and pressing Enter installs all of them
- Running "Get Recommendations" twice in quick succession uses the cached workspace analysis (no second filesystem scan)
- The "Get Recommendations" button appears in the tree view title bar
- The command is accessible via `Ctrl+Shift+P` → "Kiro Hooks: Get Recommendations"

## Testing

- Unit tests for `HookMatcher` covering each scoring signal (framework, dependency, file-pattern, language, eventType)
- Unit tests for `WorkspaceAnalysisCache` covering cache hit, cache miss, and TTL expiry
- Unit tests for `RecommendationService` covering filtering, min-score threshold, and already-installed exclusion
- Manual smoke test: open a TypeScript project, run recommendations, verify relevant hooks appear
