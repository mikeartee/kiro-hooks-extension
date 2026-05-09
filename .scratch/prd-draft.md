# PRD: kiro-hooks-extension — Bug fixes, design improvements, and schema alignment

## Problem

The extension has a cluster of related bugs and design issues that have accumulated since the initial release:

- **Hooks install to the wrong path.** `installHook`, `updateHook`, `checkForUpdates`, and `getHooksForCategory` all match hooks by filename rather than full path. Two hooks in different categories with the same filename (e.g. `git/helper.json` and `ci/helper.json`) are treated as the same hook — one gets incorrectly marked as installed, updates target the wrong file, and installs land flat in `.kiro/hooks/` instead of the correct category subfolder.
- **Existing installs are broken by the path fix.** Any hooks installed before the fix will no longer be recognised as installed once path-based matching is in place. A migration is needed.
- **A cache race condition causes stale data.** `clearCache()` is fire-and-forget (`void`), so the refresh command can fetch stale data before the cache is actually cleared.
- **`fetchHookList` crashes on a fresh repo.** If `categories.json` doesn't exist yet (404), the error propagates to the user instead of returning an empty list with a warning.
- **Unnecessary GitHub API calls on every activation.** `checkForUpdates` fetches the full hook list even when no hooks are installed.
- **Networking code is duplicated.** `GitHubClient` has two nearly-identical request/retry method pairs with no unit test coverage.
- **The tree re-fetches on every expand.** No guard prevents redundant concurrent fetches when the user collapses and re-expands the tree.
- **Category metadata is ignored.** The tree derives labels by title-casing the category ID, ignoring the `label` and `description` fields already present in `categories.json`.
- **Preview is broken for repeated opens.** The `untitled:` + `WorkspaceEdit` approach double-inserts content if the same hook is previewed twice, and prompts "save changes?" on close.
- **Config changes require a restart.** Changing `repository` or `branch` in settings has no effect until VS Code is restarted.
- **`cacheTimeout` setting is ignored.** It's declared in `package.json` but hardcoded to 3600 in the code.
- **Schema inconsistencies between repos.** Hook files use `"version": "1"` (not semver), include an undocumented `enabled` field, and the `tags` field is never populated.

## Goals

- All hook matching uses `hook.path` as the canonical identifier throughout the codebase.
- Existing flat-installed hooks are automatically migrated to their correct paths on activation.
- The cache race condition is eliminated — `clearCache()` is properly awaited.
- `fetchHookList` handles a missing `categories.json` gracefully.
- `checkForUpdates` skips the remote fetch when no hooks are installed.
- `GitHubClient` has a unified request method and unit test coverage for all error/retry scenarios.
- The tree provider does not make redundant concurrent fetches.
- Category labels and descriptions come from `categories.json`, not derived from IDs.
- Hook preview is read-only, idempotent, and closes without prompts.
- Config changes to `repository` and `branch` take effect immediately with a visible info message.
- `cacheTimeout` is read from settings and passed through to the cache.
- All hook JSON files in `kiro-hooks-docs` use semver versions, declare `enabled`, and can carry `tags`.
- The `tags` field is populated from hook JSON and shown in the tree tooltip.

## Out of scope

- Adding new hooks to `kiro-hooks-docs` beyond schema alignment.
- Changes to the Kiro hook runtime or `.kiro/hooks/` format.
- Authentication improvements (OAuth flow, token validation against GitHub API).
- Pagination of the hook list.
- Search or filtering in the tree view.

## Work items

### Bugs

- [ ] **B1 — Path-based matching** — Fix `installHook`, `updateHook`, `checkForUpdates`, and `getHooksForCategory` to use `hook.path` as the canonical identifier instead of base-name string matching.
- [ ] **B2 — Flat-install migration** — On activation, detect hooks installed at flat paths and move them to their correct category-prefixed paths by matching against the remote hook list.
- [ ] **B3 — `clearCache()` race condition** — Make `HookService.clearCache()` properly `async` and `await` the underlying `CacheManager.clear()` call.
- [ ] **B4 — `fetchHookList` NOT_FOUND handling** — Return `[]` and show a warning when `categories.json` returns a 404 instead of propagating the error.
- [ ] **B5 — `checkForUpdates` early return** — Return `[]` immediately when `getInstalledHooks()` returns an empty array, without calling `fetchHookList`.

### Design improvements

- [ ] **D1 — `GitHubClient` unification** — Merge `makeRequest`/`makeRawRequest` and their retry loops into a single generic method with a response transformer.
- [ ] **D2 — `GitHubClient` unit tests** — Add tests covering: retry behaviour, HTTP error mapping (401, 403 rate-limit, 403 forbidden, 404, 5xx, default), timeout handling, token injection (with and without token), and JSON vs raw response handling.
- [ ] **D3 — Tree provider fetch guard** — Add a loading/pending guard to `getRootItems()` to prevent redundant concurrent fetches on rapid expand/collapse.
- [ ] **D4 — Category labels from `categories.json`** — Pass `CategoryDefinition[]` through `HookService` to `HooksTreeProvider` so the tree uses the `label` and `description` fields from `categories.json`.
- [ ] **D5 — Virtual document preview** — Replace `untitled:` + `WorkspaceEdit` with a `TextDocumentContentProvider` registered under `kiro-hook://`. Read-only, idempotent, no dirty state.
- [ ] **D6 — Auto-update deduplication** — Extract a shared `performUpdateCheck(hookService, treeProvider)` helper used by both `activate()` and `handleCheckUpdates`.
- [ ] **D7 — Config change listener** — Add `onDidChangeConfiguration` listener for `kiroHooks.repository` and `kiroHooks.branch` that recreates `GitHubClient`, clears cache, refreshes tree, and shows "Settings updated — refreshing hooks...".
- [ ] **D8 — Wire `cacheTimeout` setting** — Read `kiroHooks.cacheTimeout` from configuration and pass it to `CacheManager.set()` instead of hardcoding 3600.

### Schema fixes

- [ ] **S1 — Semver versions in `kiro-hooks-docs`** — Update all hook JSON files from `"version": "1"` to `"1.0.0"`.
- [ ] **S2 — `enabled` field in `KiroHookSchema`** — Add `enabled?: boolean` to the type definition.
- [ ] **S3 — `tags` implementation** — Add `tags?: string[]` to `KiroHookSchema`, populate from hook JSON in `fetchHooksFromDirectory`, and display in the tree tooltip.

## Acceptance criteria

- A hook at `code-quality/lint-on-save.json` installs to `.kiro/hooks/code-quality/lint-on-save.kiro.hook` and is correctly shown as installed in the tree.
- Two hooks with the same filename in different categories are independently tracked — installing one does not mark the other as installed.
- After `kiroHooks.refresh`, the tree shows fresh data with no stale cache entries.
- Previewing the same hook twice opens the same read-only document without duplicating content or prompting to save on close.
- Changing `kiroHooks.repository` in settings triggers an automatic refresh with an info message — no restart required.
- `checkForUpdates` on a workspace with no installed hooks makes zero GitHub API calls.
- All hook files in `kiro-hooks-docs` pass JSON schema validation with `"version": "1.0.0"`, `"enabled": true/false`, and optional `"tags"`.
- Existing flat-installed hooks are automatically moved to their correct paths on the first activation after the update.

## Testing

- Existing `bugConditionExploration.test.ts` tests must pass after fixes (they are currently expected to fail on unfixed code).
- Existing `preservationTests.test.ts` tests must continue to pass.
- New unit tests for `GitHubClient` covering all retry, error, and auth scenarios.
- Manual smoke test: install a hook, restart VS Code, verify it appears as installed in the correct category.
- Manual smoke test: change `kiroHooks.repository` in settings, verify the tree refreshes and the info message appears.
