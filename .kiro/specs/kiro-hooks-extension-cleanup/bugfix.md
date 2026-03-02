# Bugfix Requirements Document

## Introduction

The `kiro-hooks-extension` is a VS Code extension that lets users browse, preview, and install
community Kiro agent hooks from a GitHub repository into `.kiro/hooks/`. The extension was
scaffolded quickly and is partially working. Several bugs and gaps have been identified through
code review that prevent it from being production-ready. This document captures all defects and
the expected correct behavior so the extension can be published to open-vsx.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN the `kiroHooks.update` command is triggered from the context menu on a hook node THEN
the system passes the full `HookNode` object to `handleUpdate`, which calls `extractHookMetadata`
to get `node.metadata`, but `updateHook(hook)` writes the file to `hooksDirUri/hook.name` (flat)
instead of the installed path, so hooks installed in category subdirectories are written to the
wrong location

1.2 WHEN `uninstallHook` is called with `hookPath` derived from `node.installed.path` (a relative
path like `git/auto-commit.json`) THEN the system constructs `hooksDirUri/hookPath` correctly, but
when `hookPath` falls back to `node.metadata.name` (just a filename) for hooks without an
`installed` record, the system silently deletes nothing or throws a misleading NOT_FOUND error

1.3 WHEN `fetchHookList` fetches hooks from GitHub and a `categories.json` file does not yet exist
in the repository THEN the system throws an unhandled `ExtensionError` with code `NOT_FOUND` that
propagates to the tree provider, causing the tree view to render empty with no user-facing
explanation

1.4 WHEN the tree provider calls `getRootItems` and `fetchData` throws any error THEN the system
silently returns an empty array with only a `console.error`, giving the user no feedback about
whether the extension is working or why the tree is empty

1.5 WHEN `installHook` writes the hook JSON to disk THEN the system always writes to
`hooksDirUri/hook.name` (flat, no subdirectory), ignoring the category structure from `hook.path`,
so all hooks land in `.kiro/hooks/` root regardless of their category folder in the repository

1.6 WHEN `checkForUpdates` compares installed hooks to remote hooks THEN the system matches by
`hook.name` (filename only, e.g. `auto-commit.json`) which collides if two categories contain a
file with the same name, causing false update matches or missed updates

1.7 WHEN the `kiroHooks.preview` command is invoked by clicking a hook node in the tree THEN the
`item.command` on the tree item passes the full `HookNode` object as the argument, and
`handlePreview` calls `extractHookMetadata(item)` which reads `item.metadata` — this works, but
the preview opens a plain JSON document without a title, making it hard to identify which hook is
being previewed

1.8 WHEN `TokenManager` is constructed THEN the `_onSecretsChange` parameter is typed as
`vscode.Event<vscode.SecretStorageChangeEvent> | undefined` but `context.secrets.onDidChange` is
passed directly — this compiles but the subscription is never added to `context.subscriptions`,
so it leaks if the extension is deactivated and reactivated

1.9 WHEN `CacheManager.clearCache` is called from `handleRefresh` THEN `hookService.clearCache()`
calls `void this.cacheManager.clear(this.CACHE_KEY_HOOKS)` (voiding the promise), which is
correct, but the `clearCache` method signature returns `void` while internally calling an async
method without awaiting — if the cache clear races with the subsequent `fetchHookList`, stale
data may be returned from cache

1.10 WHEN the extension activates and `autoCheckUpdates` is true but no workspace is open THEN
`hookService.checkForUpdates()` calls `getInstalledHooks()` which returns `[]` (correct), but
`fetchHookList()` still makes live GitHub API calls unnecessarily on every activation even when
there are no installed hooks to compare against

1.11 WHEN `package.json` `contributes.views` registers the view under the `"kiro"` view container
THEN the view only appears if the Kiro extension is installed and has registered that container —
if Kiro is not installed, the view is silently absent with no fallback container or error message
to the user

1.12 WHEN `HooksTreeProvider.getHooksForCategory` returns hook nodes THEN the `installed` lookup
uses `installedHooks.find(i => i.name === hook.name)` (filename match only), which is inconsistent
with the path-based matching used in the reference implementation and will produce incorrect
installed/update status when two categories have hooks with the same filename

### Expected Behavior (Correct)

2.1 WHEN `updateHook` is called with a `HookMetadata` object THEN the system SHALL resolve the
install path using the same path logic as `installHook` — writing to
`hooksDirUri/<category>/<hook.name>` when the hook has a category subdirectory — so the updated
file overwrites the correct existing file

2.2 WHEN `uninstallHook` is called THEN the system SHALL always use `node.installed.path` as the
authoritative path for deletion, and SHALL show a clear error if `installed` is undefined rather
than falling back to `metadata.name`

2.3 WHEN `fetchHookList` encounters a `NOT_FOUND` error fetching `categories.json` THEN the system
SHALL return an empty array and display a user-facing warning message explaining that the hook
repository is not yet available, rather than propagating the error

2.4 WHEN `getRootItems` catches an error from `fetchData` THEN the system SHALL display a
user-facing error notification with the error message so the user understands why the tree is empty

2.5 WHEN `installHook` writes a hook to disk THEN the system SHALL mirror the repository's
directory structure by writing to `hooksDirUri/<category>/<hook.name>` when `hook.path` contains
a subdirectory, creating the subdirectory if needed

2.6 WHEN `checkForUpdates` and `getHooksForCategory` match installed hooks to remote hooks THEN
the system SHALL match by the full relative path (e.g. `git/auto-commit.json`) rather than
filename alone, consistent with the reference implementation's path-based matching

2.7 WHEN `handlePreview` opens a hook document THEN the system SHALL set the document's title to
the hook name by using a named URI (e.g. `vscode.Uri.parse('untitled:' + hook.name)`) so the
editor tab shows a meaningful name

2.8 WHEN `TokenManager` subscribes to `onDidChange` THEN the system SHALL add the subscription
disposable to `context.subscriptions` so it is properly cleaned up on deactivation

2.9 WHEN `hookService.clearCache()` is called THEN the system SHALL await the async clear before
returning, or the `clearCache` method SHALL be made synchronous by clearing the in-memory state
immediately, so that the subsequent `fetchHookList` call always sees a clean cache

2.10 WHEN `autoCheckUpdates` runs on activation THEN the system SHALL short-circuit and skip the
GitHub fetch entirely when `getInstalledHooks()` returns an empty array, avoiding unnecessary API
calls when no hooks are installed

2.11 WHEN the `"kiro"` view container is not available (Kiro not installed) THEN the system SHALL
register the view under a fallback container (e.g. `"explorer"`) or SHALL document the Kiro
extension as a required dependency in `package.json` `extensionDependencies` so VS Code enforces
it

2.12 WHEN `HooksTreeProvider` determines installed/update status for a hook node THEN the system
SHALL match by `hook.path` (full relative path) against `installed.path`, consistent with 2.6

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a hook is installed for the first time into an empty `.kiro/hooks/` directory THEN the
system SHALL CONTINUE TO create the directory and write the hook JSON with the `_sha` field
embedded for update tracking

3.2 WHEN a hook is already installed and the user triggers install again THEN the system SHALL
CONTINUE TO prompt the user with an overwrite confirmation before replacing the file

3.3 WHEN the GitHub API returns a 401 or 403 THEN the system SHALL CONTINUE TO surface the
specific error message (invalid token / rate limit) to the user

3.4 WHEN the GitHub API returns a 404 for a specific hook file THEN the system SHALL CONTINUE TO
log the error and skip that hook without aborting the entire category fetch

3.5 WHEN a valid GitHub token is set via `kiroHooks.setToken` THEN the system SHALL CONTINUE TO
store it in VS Code secret storage and fire the token change event to refresh the tree

3.6 WHEN `kiroHooks.refresh` is invoked THEN the system SHALL CONTINUE TO clear the cache, refetch
from GitHub, and refresh the tree view

3.7 WHEN the tree view loads and hooks are available THEN the system SHALL CONTINUE TO group hooks
under category nodes with collapsed state, showing install status icons

3.8 WHEN `scanHooksDirectory` is called and `.kiro/hooks` does not exist THEN the system SHALL
CONTINUE TO return an empty array silently without logging ENOENT errors

3.9 WHEN the extension deactivates THEN the system SHALL CONTINUE TO dispose all subscriptions
registered in `context.subscriptions`

3.10 WHEN `checkForUpdates` finds hooks with no `_sha` field THEN the system SHALL CONTINUE TO
skip those hooks rather than treating them as needing an update

