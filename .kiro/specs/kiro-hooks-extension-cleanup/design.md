# Kiro Hooks Extension Cleanup Bugfix Design

## Overview

The `kiro-hooks-extension` has 12 bugs identified through code review that prevent it from being
production-ready. The bugs fall into four categories:

- **Path bugs** (1.1, 1.2, 1.5, 1.6, 1.12): hooks are written to or matched by filename only,
  ignoring the category subdirectory in `hook.path`
- **Error handling bugs** (1.3, 1.4): errors are swallowed silently instead of surfacing to the user
- **Resource/lifecycle bugs** (1.8, 1.9, 1.10): subscription leak, async race, unnecessary API call
- **UX/packaging bugs** (1.7, 1.11): untitled preview tab, missing extension dependency declaration

The fix strategy is minimal and surgical: each bug is fixed in the smallest possible change to the
affected function, with no refactoring of unrelated code.

## Glossary

- **Bug_Condition (C)**: The input condition that triggers a specific defect
- **Property (P)**: The desired correct behavior when the bug condition holds
- **Preservation**: Existing correct behaviors that must not regress
- **hook.path**: The full relative path of a hook in the repository, e.g. `git/auto-commit.json`
- **hook.name**: The filename only, e.g. `auto-commit.json` — a subset of `hook.path`
- **hooksDirUri**: The resolved VS Code URI for `.kiro/hooks/` in the workspace root
- **installed.path**: The relative path of an installed hook under `.kiro/hooks/`, mirrors `hook.path`
- **HookService**: `src/services/HookService.ts` — fetches from GitHub, reads/writes `.kiro/hooks/`
- **HooksTreeProvider**: `src/providers/HooksTreeProvider.ts` — VS Code tree data provider
- **TokenManager**: `src/services/TokenManager.ts` — wraps VS Code secret storage for GitHub tokens
- **CacheManager**: `src/services/CacheManager.ts` — TTL cache backed by VS Code `globalState`

## Bug Details

### Fault Condition

The 12 bugs share a common theme: the code uses `hook.name` (filename) where it should use
`hook.path` (full relative path), or fails to propagate errors to the user, or mismanages
async/lifecycle concerns.

**Formal Specification — path bugs (1.1, 1.5, 1.6, 1.12):**

```
FUNCTION isBugCondition_path(hook)
  INPUT: hook of type HookMetadata
  OUTPUT: boolean

  RETURN hook.path CONTAINS '/'
         -- i.e. the hook lives in a category subdirectory
END FUNCTION
```

**Formal Specification — error-swallow bugs (1.3, 1.4):**

```
FUNCTION isBugCondition_errorSwallow(error)
  INPUT: error thrown during fetchHookList or fetchData
  OUTPUT: boolean

  RETURN error IS ExtensionError WITH code = NOT_FOUND   -- bug 1.3
      OR error IS ANY Error thrown from fetchData         -- bug 1.4
END FUNCTION
```

**Formal Specification — lifecycle bugs (1.8, 1.9, 1.10):**

```
FUNCTION isBugCondition_lifecycle(context)
  INPUT: extension activation context
  OUTPUT: boolean

  RETURN TokenManager._onSecretsChange subscription NOT IN context.subscriptions  -- 1.8
      OR clearCache called WITHOUT await before fetchHookList                      -- 1.9
      OR checkForUpdates called WHEN getInstalledHooks() returns []                -- 1.10
END FUNCTION
```

### Examples

- Bug 1.1/1.5: Hook `git/auto-commit.json` is installed to `.kiro/hooks/auto-commit.json`
  instead of `.kiro/hooks/git/auto-commit.json`
- Bug 1.2: Uninstalling a hook node with no `installed` record silently does nothing or throws
  a misleading NOT_FOUND error
- Bug 1.3: Fresh install with no `categories.json` in the repo causes the tree to render empty
  with no explanation
- Bug 1.4: A network error during tree load shows an empty tree with no user notification
- Bug 1.6/1.12: Two categories each containing `readme-helper.json` — the wrong hook gets
  marked as installed or needing an update
- Bug 1.7: Preview tab shows `Untitled-1` instead of `auto-commit.json`
- Bug 1.8: After extension reload, the secrets change listener fires twice (leaked subscription)
- Bug 1.9: Refresh clears cache but `fetchHookList` immediately returns stale cached data
- Bug 1.10: On every activation with no hooks installed, the extension makes live GitHub API calls
- Bug 1.11: On a machine without Kiro installed, the Hooks Browser view is silently absent

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**

- First-time install into empty `.kiro/hooks/` creates the directory and embeds `_sha` (3.1)
- Re-install of an existing hook prompts for overwrite confirmation (3.2)
- GitHub 401/403 surfaces the specific error message to the user (3.3)
- GitHub 404 for a specific hook file logs and skips without aborting the category (3.4)
- Setting a token via `kiroHooks.setToken` stores it and fires the token change event (3.5)
- `kiroHooks.refresh` clears cache, refetches, and refreshes the tree (3.6)
- Tree groups hooks under category nodes with install status icons (3.7)
- `scanHooksDirectory` returns `[]` silently when `.kiro/hooks` does not exist (3.8)
- All subscriptions in `context.subscriptions` are disposed on deactivation (3.9)
- Hooks with no `_sha` field are skipped in `checkForUpdates` (3.10)

**Scope:**

All inputs that do NOT involve a hook with a category subdirectory in its path, and all flows
that do not involve the specific error/lifecycle conditions above, must be completely unaffected.

## Hypothesized Root Cause

1. **Copy-paste of `hook.name` instead of `hook.path`** (bugs 1.1, 1.5, 1.6, 1.12): The initial
   scaffold used `hook.name` everywhere for simplicity. The `HookMetadata.path` field exists and
   is populated correctly by `fetchHooksFromDirectory`, but was never threaded through to the
   write/match logic.

2. **Missing error escalation** (bugs 1.3, 1.4): The `catch` blocks call `console.error` and
   return empty arrays, which is correct for individual hook fetch failures (3.4) but wrong for
   top-level failures where the user needs feedback.

3. **Forgotten disposable** (bug 1.8): The `_onSecretsChange` callback registration returns a
   `Disposable` that was never captured or pushed to `context.subscriptions`.

4. **`void` on async call** (bug 1.9): `clearCache` uses `void this.cacheManager.clear(...)`,
   which fires the async operation but does not wait for it. The caller in `handleRefresh` also
   does not await `clearCache`.

5. **Missing early-exit guard** (bug 1.10): `checkForUpdates` always calls `fetchHookList` even
   when `installedHooks` is empty, wasting an API call.

6. **Untitled URI** (bug 1.7): `vscode.workspace.openTextDocument({ content, language })` always
   creates an untitled document with a generated name. Using a named `untitled:` URI gives the
   tab a meaningful title.

7. **Missing `extensionDependencies`** (bug 1.11): The `"kiro"` view container is contributed by
   the Kiro extension. Without declaring it as a dependency, VS Code does not enforce its presence.

## Correctness Properties

Property 1: Fault Condition - Path-Based File Write (installHook and updateHook)

_For any_ `HookMetadata` where `hook.path` contains a `/` (i.e. the hook lives in a category
subdirectory), `installHook` and `updateHook` SHALL write the file to
`hooksDirUri/<hook.path>` (creating intermediate directories as needed), not to
`hooksDirUri/<hook.name>`.

**Validates: Requirements 2.1, 2.5**

Property 2: Fault Condition - Path-Based Matching (checkForUpdates and getHooksForCategory)

_For any_ set of installed hooks where two or more hooks share the same `name` but differ in
`path`, `checkForUpdates` and `getHooksForCategory` SHALL match by `installed.path === hook.path`
and SHALL NOT produce false positive or false negative update/install status.

**Validates: Requirements 2.6, 2.12**

Property 3: Fault Condition - Graceful NOT_FOUND for categories.json

_For any_ invocation of `fetchHookList` where the GitHub client throws an `ExtensionError` with
code `NOT_FOUND` for `categories.json`, the function SHALL return `[]` and SHALL display a
user-facing warning message, and SHALL NOT propagate the error to the caller.

**Validates: Requirements 2.3**

Property 4: Fault Condition - User Notification on Tree Load Error

_For any_ error thrown by `fetchData` inside `getRootItems`, the provider SHALL call
`vscode.window.showErrorMessage` with the error message and SHALL return `[]`, so the user
receives feedback about why the tree is empty.

**Validates: Requirements 2.4**

Property 5: Preservation - Non-Subdirectory Hooks Unaffected by Path Fix

_For any_ `HookMetadata` where `hook.path === hook.name` (no subdirectory), `installHook`,
`updateHook`, `checkForUpdates`, and `getHooksForCategory` SHALL produce exactly the same
behavior as before the fix.

**Validates: Requirements 3.1, 3.2, 3.7**

Property 6: Preservation - Cache Clear Happens Before Fetch

_For any_ invocation of `handleRefresh`, the cache SHALL be fully cleared before
`fetchHookList` is called, so that `fetchHookList` never returns stale data from a cache that
was supposed to have been cleared.

**Validates: Requirements 3.6**

## Fix Implementation

### Changes Required

**File: `src/services/HookService.ts`**

**Bug 1.5 — `installHook` flat path:**

```
BEFORE: const fileUri = vscode.Uri.joinPath(hooksDirUri, hook.name);
AFTER:  const fileUri = vscode.Uri.joinPath(hooksDirUri, hook.path);
        // Also create the parent directory (not just hooksDirUri):
        const parentUri = vscode.Uri.joinPath(hooksDirUri, ...hook.path.split('/').slice(0, -1));
        await vscode.workspace.fs.createDirectory(parentUri);
```

**Bug 1.1 — `updateHook` flat path:**

```
BEFORE: const fileUri = vscode.Uri.joinPath(hooksDirUri, hook.name);
AFTER:  const fileUri = vscode.Uri.joinPath(hooksDirUri, hook.path);
        // Also create the parent directory in case it was deleted:
        const parentUri = vscode.Uri.joinPath(hooksDirUri, ...hook.path.split('/').slice(0, -1));
        await vscode.workspace.fs.createDirectory(parentUri);
```

**Bug 1.6 — `checkForUpdates` filename match:**

```
BEFORE: const remote = remoteHooks.find(h => h.name === installed.name);
AFTER:  const remote = remoteHooks.find(h => h.path === installed.path);
```

**Bug 1.3 — `fetchHookList` NOT_FOUND propagation:**

```
BEFORE: throw error;  (in the outer catch)
AFTER:  if (error instanceof ExtensionError && error.code === ErrorCode.NOT_FOUND) {
            vscode.window.showWarningMessage(
                'Hook repository not yet available (categories.json not found).'
            );
            return [];
        }
        throw error;
```

**Bug 1.9 — `clearCache` async race:**

```
BEFORE: clearCache(): void { void this.cacheManager.clear(this.CACHE_KEY_HOOKS); }
AFTER:  async clearCache(): Promise<void> { await this.cacheManager.clear(this.CACHE_KEY_HOOKS); }
```

**Bug 1.10 — `checkForUpdates` unnecessary fetch:**

```
// Add at the top of checkForUpdates, before fetchHookList:
const installedHooks = await this.getInstalledHooks();
if (installedHooks.length === 0) {
    return [];
}
const remoteHooks = await this.fetchHookList();
// ... rest of method uses already-fetched installedHooks
```

---

**File: `src/providers/HooksTreeProvider.ts`**

**Bug 1.4 — `getRootItems` silent error:**

```
BEFORE: console.error('Failed to load hooks:', error);
        return [];
AFTER:  const msg = error instanceof Error ? error.message : 'Unknown error';
        vscode.window.showErrorMessage(`Failed to load hooks: ${msg}`);
        return [];
```

**Bug 1.12 — `getHooksForCategory` filename match:**

```
BEFORE: const installed = this.installedHooks.find(i => i.name === hook.name);
AFTER:  const installed = this.installedHooks.find(i => i.path === hook.path);
```

---

**File: `src/commands/index.ts`**

**Bug 1.2 — `handleUninstall` fallback to metadata.name:**

```
BEFORE: const hookPath = node?.installed?.path ?? node?.metadata?.name;
AFTER:  const hookPath = node?.installed?.path;
        if (!hookPath) {
            vscode.window.showErrorMessage(
                'Cannot uninstall: hook has no installation record. It may not be installed.'
            );
            return;
        }
```

**Bug 1.7 — `handlePreview` untitled tab:**

```
BEFORE: const doc = await vscode.workspace.openTextDocument({ content, language: 'json' });
AFTER:  const uri = vscode.Uri.parse(`untitled:${hook.name}`);
        const doc = await vscode.workspace.openTextDocument(uri);
        // Set content via edit since untitled URIs don't accept content directly:
        const edit = new vscode.WorkspaceEdit();
        edit.insert(uri, new vscode.Position(0, 0), content);
        await vscode.workspace.applyEdit(edit);
```

**Bug 1.9 — await clearCache in handleRefresh:**

```
BEFORE: hookService.clearCache();
AFTER:  await hookService.clearCache();
```

---

**File: `src/services/TokenManager.ts`**

**Bug 1.8 — subscription not added to context.subscriptions:**

The `TokenManager` constructor must accept `context.subscriptions` or the caller must capture
the disposable. The cleanest fix is to return the disposable from the constructor and push it
at the call site in `extension.ts`:

```
// In extension.ts (activate):
const tokenManager = new TokenManager(context.secrets, context.secrets.onDidChange);
// TokenManager constructor now pushes the subscription internally via a passed-in push fn,
// OR the constructor returns a disposable that the caller pushes.

// Simplest: change constructor to accept subscriptions array:
constructor(
    private readonly secrets: vscode.SecretStorage,
    subscriptions: vscode.Disposable[],
    onSecretsChange?: vscode.Event<vscode.SecretStorageChangeEvent>
)
// Then inside: if (onSecretsChange) { subscriptions.push(onSecretsChange(...)); }
```

---

**File: `package.json`**

**Bug 1.11 — missing extensionDependencies:**

```json
"extensionDependencies": ["kirolabs.kiro"]
```

Add this field at the top level of `package.json`. This causes VS Code to enforce that the Kiro
extension is installed before activating this extension, ensuring the `"kiro"` view container
is always available.

## Testing Strategy

### Validation Approach

Two-phase approach: first run exploratory tests on unfixed code to confirm root causes, then
run fix-checking and preservation tests on the fixed code.

### Exploratory Fault Condition Checking

**Goal**: Confirm root causes before implementing fixes.

**Test Plan**: Write unit tests that exercise each buggy code path with inputs that satisfy the
bug condition, and assert the incorrect behavior is observed on unfixed code.

**Test Cases:**

1. **Path write test (1.1/1.5)**: Call `installHook` with a hook where `path = 'git/auto-commit.json'`
   and `name = 'auto-commit.json'`. Assert the file is written to the wrong location on unfixed code.
2. **Uninstall fallback test (1.2)**: Call `handleUninstall` with a node that has no `installed`
   record. Assert no error message is shown on unfixed code (silent failure).
3. **NOT_FOUND propagation test (1.3)**: Mock `getRawFileContent` to throw `NOT_FOUND`. Assert
   `fetchHookList` throws on unfixed code.
4. **Silent error test (1.4)**: Mock `fetchData` to throw. Assert no `showErrorMessage` call on
   unfixed code.
5. **Path match test (1.6/1.12)**: Create two installed hooks with same `name` but different `path`.
   Assert wrong hook gets matched on unfixed code.
6. **Cache race test (1.9)**: Call `clearCache` then immediately `fetchHookList`. Assert stale
   data is returned on unfixed code.
7. **Unnecessary fetch test (1.10)**: Mock `getInstalledHooks` to return `[]`. Assert
   `fetchHookList` is still called on unfixed code.

**Expected Counterexamples:**

- `installHook` writes to `hooksDirUri/auto-commit.json` instead of `hooksDirUri/git/auto-commit.json`
- `handleUninstall` silently returns without showing an error when `installed` is undefined
- `fetchHookList` throws `ExtensionError(NOT_FOUND)` instead of returning `[]`

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed function produces
the expected behavior.

**Pseudocode:**

```
FOR ALL hook WHERE hook.path CONTAINS '/' DO
  installHook(hook)
  ASSERT fileWrittenTo = hooksDirUri + '/' + hook.path
  ASSERT directoryCreated(hooksDirUri + '/' + hook.path.split('/')[0])
END FOR

FOR ALL fetchHookList call WHERE categories.json returns NOT_FOUND DO
  result := fetchHookList()
  ASSERT result = []
  ASSERT showWarningMessage called
END FOR

FOR ALL getRootItems call WHERE fetchData throws DO
  result := getRootItems()
  ASSERT result = []
  ASSERT showErrorMessage called
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed function
produces the same result as the original function.

**Pseudocode:**

```
FOR ALL hook WHERE hook.path = hook.name DO
  ASSERT installHook_original(hook) = installHook_fixed(hook)
  ASSERT updateHook_original(hook) = updateHook_fixed(hook)
END FOR

FOR ALL installedHooks WHERE all paths are unique filenames DO
  ASSERT checkForUpdates_original(installedHooks) = checkForUpdates_fixed(installedHooks)
END FOR
```

**Testing Approach**: Property-based testing is recommended for the path-matching bugs because
the input space (hook names, paths, category combinations) is large and collision cases are
easy to miss with hand-written examples.

**Test Cases:**

1. **Flat hook preservation**: Hook with `path = name = 'simple.json'` — install, update, match
   behavior must be identical before and after fix.
2. **Overwrite prompt preservation**: Re-installing an existing hook still prompts for overwrite.
3. **Token storage preservation**: `setToken` / `clearToken` / `getToken` round-trip unchanged.
4. **Refresh flow preservation**: `kiroHooks.refresh` still clears cache and refetches.

### Unit Tests

- `installHook` with subdirectory path writes to correct nested location
- `installHook` with flat path (no subdirectory) writes to root of hooksDir (unchanged)
- `updateHook` with subdirectory path writes to correct nested location
- `uninstallHook` with no `installed` record shows error message
- `fetchHookList` returns `[]` and shows warning when `categories.json` is NOT_FOUND
- `getRootItems` calls `showErrorMessage` when `fetchData` throws
- `checkForUpdates` returns `[]` immediately when no hooks installed (no GitHub call)
- `checkForUpdates` matches by `path` not `name`
- `getHooksForCategory` matches installed status by `path` not `name`
- `clearCache` is awaited before `fetchHookList` in `handleRefresh`
- `TokenManager` subscription disposable is in `context.subscriptions`

### Property-Based Tests

- Generate random hook lists where some categories share filenames — verify `checkForUpdates`
  never produces false positives (matches only by full path)
- Generate random hook lists where some categories share filenames — verify `getHooksForCategory`
  assigns installed status only to the hook whose path matches
- Generate hooks with paths of depth 1, 2, and 3 — verify `installHook` always writes to the
  correct nested location

### Integration Tests

- Full install flow: fetch list → install hook in subdirectory → verify file at correct path →
  scan installed hooks → verify `installed.path` matches `hook.path`
- Full update flow: install hook → modify remote SHA → `checkForUpdates` → update → verify
  file overwritten at correct path
- Refresh flow: install hook → refresh → verify tree still shows hook as installed

