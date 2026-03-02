# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Fault Condition** - Path Write, Path Match, Error Swallow, and Lifecycle Bugs
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bugs exist
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bugs exist
  - **Scoped PBT Approach**: Scope to concrete failing cases for each bug condition
  - Test 1.1/1.5 — Call `installHook` with `{ path: 'git/auto-commit.json', name: 'auto-commit.json' }` and assert file is written to `hooksDirUri/git/auto-commit.json` (isBugCondition_path: hook.path contains '/')
  - Test 1.6/1.12 — Create two installed hooks with same `name` but different `path`; assert `checkForUpdates` and `getHooksForCategory` match by `path`, not `name`
  - Test 1.3 — Mock `getRawFileContent` to throw `ExtensionError(NOT_FOUND)`; assert `fetchHookList` returns `[]` and calls `showWarningMessage` (isBugCondition_errorSwallow: NOT_FOUND on categories.json)
  - Test 1.4 — Mock `fetchData` to throw; assert `getRootItems` calls `showErrorMessage` (isBugCondition_errorSwallow: any error from fetchData)
  - Test 1.9 — Call `clearCache` then immediately `fetchHookList`; assert stale data is NOT returned (isBugCondition_lifecycle: clearCache without await)
  - Test 1.10 — Mock `getInstalledHooks` to return `[]`; assert `fetchHookList` is NOT called (isBugCondition_lifecycle: checkForUpdates with empty installed list)
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests FAIL (this is correct - it proves the bugs exist)
  - Document counterexamples found (e.g., `installHook` writes to `hooksDirUri/auto-commit.json` instead of `hooksDirUri/git/auto-commit.json`)
  - Mark task complete when tests are written, run, and failures are documented
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.9, 1.10, 1.12_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Flat-Path Hooks and Existing Flows Unaffected
  - **IMPORTANT**: Follow observation-first methodology
  - Observe: `installHook` with `{ path: 'simple.json', name: 'simple.json' }` writes to `hooksDirUri/simple.json` on unfixed code
  - Observe: Re-installing an existing hook still triggers overwrite confirmation prompt on unfixed code
  - Observe: `kiroHooks.refresh` clears cache and refetches on unfixed code
  - Observe: `scanHooksDirectory` returns `[]` silently when `.kiro/hooks` does not exist on unfixed code
  - Write property-based test: for all hooks where `hook.path === hook.name` (no subdirectory), `installHook`, `updateHook`, `checkForUpdates`, and `getHooksForCategory` produce identical results before and after fix (from Preservation Requirements 3.1, 3.2, 3.7 in design)
  - Write property-based test: generate random hook lists where all paths are unique filenames — verify `checkForUpdates` produces the same matches as before the fix
  - Verify tests PASS on UNFIXED code
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10_

- [x] 3. Fix all 12 bugs in kiro-hooks-extension

  - [x] 3.1 Fix path bugs in `src/services/HookService.ts` (bugs 1.1, 1.5, 1.6)
    - `installHook`: change `vscode.Uri.joinPath(hooksDirUri, hook.name)` to `vscode.Uri.joinPath(hooksDirUri, hook.path)`; compute `parentUri` from `hook.path.split('/').slice(0, -1)` and call `createDirectory(parentUri)` before writing
    - `updateHook`: same path fix as `installHook` — use `hook.path` and create parent directory
    - `checkForUpdates`: change `remoteHooks.find(h => h.name === installed.name)` to `remoteHooks.find(h => h.path === installed.path)`
    - _Bug_Condition: isBugCondition_path(hook) where hook.path contains '/'_
    - _Expected_Behavior: file written to hooksDirUri/hook.path with intermediate directories created (Requirements 2.1, 2.5); checkForUpdates matches by full path (Requirement 2.6)_
    - _Preservation: hooks where hook.path === hook.name must produce identical behavior (Requirement 3.1, 3.2, 3.7)_
    - _Requirements: 2.1, 2.5, 2.6, 3.1, 3.2, 3.7_

  - [x] 3.2 Fix error-handling bugs in `src/services/HookService.ts` (bug 1.3) and `src/providers/HooksTreeProvider.ts` (bug 1.4)
    - `fetchHookList` outer catch: add guard `if (error instanceof ExtensionError && error.code === ErrorCode.NOT_FOUND)` → call `vscode.window.showWarningMessage('Hook repository not yet available (categories.json not found).')` and `return []`; re-throw all other errors
    - `getRootItems` catch: replace `console.error(...)` with `vscode.window.showErrorMessage(\`Failed to load hooks: ${msg}\`)` where `msg = error instanceof Error ? error.message : 'Unknown error'`
    - _Bug_Condition: isBugCondition_errorSwallow — NOT_FOUND on categories.json (1.3) or any error from fetchData (1.4)_
    - _Expected_Behavior: fetchHookList returns [] with user-facing warning (Requirement 2.3); getRootItems shows error notification (Requirement 2.4)_
    - _Preservation: GitHub 404 for individual hook files still logs and skips without aborting (Requirement 3.4)_
    - _Requirements: 2.3, 2.4, 3.3, 3.4_

  - [x] 3.3 Fix path-match bug in `src/providers/HooksTreeProvider.ts` (bug 1.12)
    - `getHooksForCategory`: change `this.installedHooks.find(i => i.name === hook.name)` to `this.installedHooks.find(i => i.path === hook.path)`
    - _Bug_Condition: isBugCondition_path — two hooks share the same name but differ in path_
    - _Expected_Behavior: installed status assigned only to the hook whose path matches (Requirement 2.12)_
    - _Preservation: tree still groups hooks under category nodes with correct install status icons (Requirement 3.7)_
    - _Requirements: 2.12, 3.7_

  - [x] 3.4 Fix command bugs in `src/commands/index.ts` (bugs 1.2, 1.7, 1.9)
    - `handleUninstall`: remove `?? node?.metadata?.name` fallback; add early return with `vscode.window.showErrorMessage('Cannot uninstall: hook has no installation record. It may not be installed.')` when `hookPath` is undefined
    - `handlePreview`: replace `vscode.workspace.openTextDocument({ content, language: 'json' })` with named untitled URI approach — `const uri = vscode.Uri.parse(\`untitled:${hook.name}\`)`, open the document, then insert content via `WorkspaceEdit` so the tab title shows the hook name
    - `handleRefresh`: change `hookService.clearCache()` to `await hookService.clearCache()` so cache is fully cleared before the subsequent fetch
    - _Bug_Condition: node.installed undefined (1.2); untitled URI (1.7); clearCache not awaited (1.9)_
    - _Expected_Behavior: uninstall shows clear error when no install record (2.2); preview tab shows hook name (2.7); cache cleared before fetch (2.9)_
    - _Preservation: refresh flow still clears cache, refetches, and refreshes tree (Requirement 3.6)_
    - _Requirements: 2.2, 2.7, 2.9, 3.6_

  - [x] 3.5 Fix lifecycle bugs in `src/services/HookService.ts` (bugs 1.9, 1.10) and `src/services/TokenManager.ts` (bug 1.8)
    - `HookService.clearCache`: change signature from `clearCache(): void` to `async clearCache(): Promise<void>` and change `void this.cacheManager.clear(...)` to `await this.cacheManager.clear(...)`
    - `HookService.checkForUpdates`: add early-exit guard at the top — fetch `installedHooks` first; if `installedHooks.length === 0` return `[]` immediately without calling `fetchHookList`
    - `TokenManager` constructor: change signature to accept `subscriptions: vscode.Disposable[]`; inside, push the `onSecretsChange(...)` disposable to `subscriptions` so it is cleaned up on deactivation
    - Update call site in `extension.ts` to pass `context.subscriptions` to `TokenManager` constructor
    - _Bug_Condition: isBugCondition_lifecycle — subscription leak (1.8), async race (1.9), unnecessary fetch (1.10)_
    - _Expected_Behavior: subscription disposed on deactivation (2.8); cache cleared before fetch (2.9); no GitHub call when no hooks installed (2.10)_
    - _Preservation: all subscriptions in context.subscriptions disposed on deactivation (Requirement 3.9); refresh flow unaffected (Requirement 3.6)_
    - _Requirements: 2.8, 2.9, 2.10, 3.6, 3.9_

  - [x] 3.6 Fix packaging bug in `package.json` (bug 1.11)
    - Add `"extensionDependencies": ["kirolabs.kiro"]` at the top level of `package.json`
    - This ensures VS Code enforces Kiro is installed before activating this extension, so the `"kiro"` view container is always available
    - _Bug_Condition: Kiro extension not installed, view container silently absent_
    - _Expected_Behavior: VS Code enforces Kiro as a prerequisite (Requirement 2.11)_
    - _Requirements: 2.11_

  - [x] 3.7 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Path Write, Path Match, Error Swallow, and Lifecycle Bugs
    - **IMPORTANT**: Re-run the SAME tests from task 1 - do NOT write new tests
    - The tests from task 1 encode the expected behavior
    - When these tests pass, it confirms the expected behavior is satisfied for all 12 bugs
    - Run bug condition exploration tests from step 1
    - **EXPECTED OUTCOME**: Tests PASS (confirms all bugs are fixed)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10, 2.11, 2.12_

  - [x] 3.8 Verify preservation tests still pass
    - **Property 2: Preservation** - Flat-Path Hooks and Existing Flows Unaffected
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all preservation behaviors still hold after all 12 fixes

- [x] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

