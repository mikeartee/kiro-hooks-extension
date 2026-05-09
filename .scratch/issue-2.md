Sub-issue of #1.

## Problem

Two small but impactful bugs in `HookService`:

1. `clearCache()` calls `void this.cacheManager.clear(...)` and returns `void`. The `handleRefresh` command awaits it, so there's a race — the cache may not be cleared before `fetchHookList` runs, returning stale data.
2. `checkForUpdates` calls `fetchHookList()` even when `getInstalledHooks()` returns `[]`, wasting a GitHub API call on every activation for users with no hooks installed.

## Work

- Make `HookService.clearCache()` properly `async` — `await this.cacheManager.clear(...)`
- Add an early return in `checkForUpdates` when `installedHooks.length === 0`

## Acceptance criteria

- After `kiroHooks.refresh`, the tree always shows fresh data with no stale cache entries
- `checkForUpdates` on a workspace with no installed hooks makes zero GitHub API calls
- `bugConditionExploration.test.ts` Bug 1.9 and Bug 1.10 tests pass
