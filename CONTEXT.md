# Context — kiro-hooks-extension

## What this is

A VS Code extension that lets users browse, preview, install, update, and uninstall community Kiro agent hooks from a GitHub repository. Hooks are JSON files that automate Kiro agent behaviour in response to IDE events.

## Domain vocabulary

**Hook** — A JSON file following the Kiro hook schema. Defines a trigger (`when`) and an action (`then`). Lives in `.kiro/hooks/` in a workspace when installed. File extension is `.kiro.hook`.

**Remote hook** — A hook that exists in the GitHub source repository (`kiro-hooks-docs`) but is not yet installed in the user's workspace.

**Installed hook** — A hook that has been written to `.kiro/hooks/` in the user's workspace.

**Hook metadata** (`HookMetadata`) — Lightweight descriptor for a remote hook: name, path, category, version, SHA, event type, action type, tags. Fetched from GitHub and cached locally.

**SHA** — The GitHub blob SHA of a hook file. Used as a version fingerprint to detect when a remote hook has changed. Embedded in the installed `.kiro.hook` file as `_sha` for update tracking.

**Category** — A logical grouping of hooks (e.g. `code-quality`, `testing`, `security`). Defined in `categories.json` in the remote repo. Maps to a subdirectory in the remote repo and a folder node in the tree view.

**Hook path** — The full relative path of a hook within the remote repo (e.g. `code-quality/lint-on-save.json`). Used as the canonical identifier for matching remote hooks to installed hooks. Distinct from hook name.

**Hook name** — The human-readable display name from the hook's `name` field (e.g. `"Lint on Save"`). Not unique across categories.

**Cache** — In-memory + `globalState` persistence of the fetched hook list. TTL-based. Keyed by `hookList`. Avoids redundant GitHub API calls.

**Token** — A GitHub Personal Access Token stored in VS Code's `SecretStorage`. Optional but increases API rate limits. Detected by prefix (`ghp_`, `github_pat_`, `gho_`, `ghs_`).

**Update** — A remote hook whose SHA differs from the `_sha` embedded in the installed copy. Detected by `checkForUpdates()`.

**Migration** — The one-time process of detecting flat-installed hooks (installed before path-aware install was implemented) and moving them to their correct category-prefixed path.

## Architecture

```
extension.ts          — activation, wires services together, config change listener
services/
  GitHubClient.ts     — HTTP requests to GitHub API and raw.githubusercontent.com
  HookService.ts      — business logic: fetch, install, uninstall, update, check updates
  CacheManager.ts     — TTL cache backed by vscode.Memento (globalState)
  TokenManager.ts     — SecretStorage wrapper for GitHub PAT
providers/
  HooksTreeProvider.ts — TreeDataProvider: categories → hooks, install status icons
commands/
  index.ts            — registers all vscode.commands, delegates to HookService
models/
  types.ts            — shared types and enums
```

## Recommendation system vocabulary

**Workspace context** — A snapshot of the current workspace: detected languages, frameworks, dependencies, file patterns, project type, and already-installed hooks. Built by `WorkspaceAnalyzer` and cached by `WorkspaceAnalysisCache`.

**Scored hook** — A `HookMetadata` paired with a numeric relevance score and a list of match reasons explaining why it was recommended.

**Match reason** — A typed explanation of why a hook scored points: `framework`, `dependency`, `file-pattern`, `language`, or `project-type`.

**HookMatcher** — Scores a hook against a workspace context using weighted signals: tag-to-framework match (30pts), tag-to-dependency match (20pts), tag-to-file-pattern match (15pts), tag-to-language match (10pts), eventType relevance (10pts).

**RecommendationService** — Orchestrates workspace analysis, hook fetching, scoring, and filtering. Returns a ranked list of scored hooks above a minimum score threshold.

**WorkspaceAnalysisCache** — TTL-based in-memory cache for workspace analysis results. Prevents re-scanning the filesystem on every recommendation request within the same session.

## Key invariants

- Hook matching between remote and installed is always by **path** (not name). Two hooks in different categories can share the same filename.
- Installed hooks live flat in `.kiro/hooks/` with the `.kiro.hook` extension. The relative path stored in `InstalledHook.path` is relative to `.kiro/hooks/`.
- The `_sha` field embedded in installed hook files is the source of truth for update detection.
- `clearCache()` must be awaited before `fetchHookList()` to avoid stale data races.
- The tree provider must not re-fetch data on every expand — fetches are guarded by a loading flag.
