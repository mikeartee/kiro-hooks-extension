Sub-issue of #1.

## Problem

Three related issues in the extension wiring layer (`extension.ts` and `commands/index.ts`):

1. The auto-update check flow in `activate()` is ~30 lines of UI logic (QuickPick, messages, looping updates) that duplicates what `handleCheckUpdates` in `commands/index.ts` already does.
2. Changing `kiroHooks.repository` or `kiroHooks.branch` in settings has no effect until VS Code is restarted — the old `GitHubClient` instance keeps running.
3. `kiroHooks.cacheTimeout` is declared as a user-configurable setting in `package.json` but `HookService` hardcodes `3600` seconds.

## Work

- Extract a `performUpdateCheck(hookService: HookService, treeProvider: HooksTreeProvider): Promise<void>` helper function in `commands/index.ts` and use it in both `activate()` and `handleCheckUpdates`
- Add a `vscode.workspace.onDidChangeConfiguration` listener in `activate()` that watches `kiroHooks.repository` and `kiroHooks.branch` — on change, recreate `GitHubClient` with the new values, update `HookService`, clear the cache, refresh the tree, and show `vscode.window.showInformationMessage('Settings updated — refreshing hooks...')`
- Read `kiroHooks.cacheTimeout` from configuration in `HookService` (or pass it in at construction) and use it in `cacheManager.set()` calls instead of the hardcoded `3600`

## Acceptance criteria

- No duplicated update-check UI logic between `activate()` and `handleCheckUpdates`
- Changing `kiroHooks.repository` in settings triggers an automatic refresh with the info message — no restart required
- Changing `kiroHooks.cacheTimeout` to 60 causes the hook list cache to expire after 60 seconds
