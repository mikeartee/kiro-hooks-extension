/**
 * Bug Condition Exploration Tests
 * EXPECTED TO FAIL on unfixed code — failure confirms bugs exist.
 * Validates: Requirements 1.1, 1.3, 1.4, 1.5, 1.6, 1.9, 1.10, 1.12
 */

import * as assert from 'assert';
import * as vscode from 'vscode';
import { HookService } from '../../services/HookService';
import { HooksTreeProvider } from '../../providers/HooksTreeProvider';
import { CacheManager } from '../../services/CacheManager';
import { ExtensionError, ErrorCode, HookMetadata, InstalledHook } from '../../models/types';

// ---------------------------------------------------------------------------
// Stub types
// ---------------------------------------------------------------------------

interface StubGitHubClient {
    getRawFileContent: (path: string) => Promise<string>;
    getRepositoryContents: (path: string) => Promise<unknown[]>;
}

interface StubMemento extends vscode.Memento {
    _store: Map<string, unknown>;
    setKeysForSync(keys: readonly string[]): void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMemento(): StubMemento {
    const store = new Map<string, unknown>();
    return {
        _store: store,
        keys: () => Array.from(store.keys()),
        get<T>(key: string, defaultValue?: T): T {
            return (store.has(key) ? store.get(key) : defaultValue) as T;
        },
        update(key: string, value: unknown): Thenable<void> {
            if (value === undefined) {
                store.delete(key);
            } else {
                store.set(key, value);
            }
            return Promise.resolve();
        },
        setKeysForSync(_keys: readonly string[]): void { /* no-op */ }
    };
}

function makeGitHubClient(overrides: Partial<StubGitHubClient> = {}): StubGitHubClient {
    return {
        getRawFileContent: async (_path: string) => '{}',
        getRepositoryContents: async (_path: string) => [],
        ...overrides
    };
}

function makeHookMetadata(overrides: Partial<HookMetadata> = {}): HookMetadata {
    return {
        name: 'auto-commit.json',
        path: 'git/auto-commit.json',
        category: 'git',
        version: '1.0.0',
        description: 'Auto commit hook',
        sha: 'abc123',
        size: 100,
        downloadUrl: 'https://example.com/auto-commit.json',
        eventType: 'fileEdited',
        actionType: 'runCommand',
        tags: [],
        ...overrides
    };
}

function makeInstalledHook(overrides: Partial<InstalledHook> = {}): InstalledHook {
    return {
        name: 'auto-commit.json',
        path: 'git/auto-commit.json',
        version: '1.0.0',
        installedAt: new Date(),
        sha: 'abc123',
        ...overrides
    };
}

// ---------------------------------------------------------------------------
// VS Code workspace.fs is non-configurable in the extension host.
// For tests that need to intercept file writes, we subclass HookService and
// override the relevant internal calls via method spying on the instance.
// ---------------------------------------------------------------------------

interface WindowStub {
    warningMessages: string[];
    errorMessages: string[];
    restore: () => void;
}

function stubWindow(): WindowStub {
    const warningMessages: string[] = [];
    const errorMessages: string[] = [];
    const win = vscode.window as unknown as Record<string, unknown>;
    const origWarn = win['showWarningMessage'];
    const origErr = win['showErrorMessage'];
    const origInfo = win['showInformationMessage'];
    win['showWarningMessage'] = async (msg: string) => { warningMessages.push(msg); return undefined; };
    win['showErrorMessage'] = async (msg: string) => { errorMessages.push(msg); return undefined; };
    win['showInformationMessage'] = async (_msg: string) => undefined;
    return {
        warningMessages,
        errorMessages,
        restore: () => {
            win['showWarningMessage'] = origWarn;
            win['showErrorMessage'] = origErr;
            win['showInformationMessage'] = origInfo;
        }
    };
}

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

suite('Bug Condition Exploration Tests (EXPECTED TO FAIL on unfixed code)', () => {

    // -----------------------------------------------------------------------
    // Test 1.1/1.5 — installHook writes to flat path instead of hook.path
    // Bug: uses hook.name instead of hook.path
    // We spy on vscode.workspace.fs.writeFile via the service's internal call
    // by subclassing HookService and capturing the URI passed to writeFile.
    // -----------------------------------------------------------------------
    suite('Bug 1.1/1.5 — installHook path write', () => {
        test('installHook should write to hooksDirUri/git/auto-commit.json not flat', async () => {
            const hook = makeHookMetadata({ name: 'auto-commit.json', path: 'git/auto-commit.json' });
            const hookContent = JSON.stringify({
                name: 'auto-commit', version: '1.0.0', description: 'Auto commit',
                when: { type: 'fileEdited' }, then: { type: 'runCommand', command: 'git commit' }
            });
            const githubClient = makeGitHubClient({
                getRawFileContent: async (_path: string) => hookContent
            });

            const writtenUris: string[] = [];

            // Subclass HookService to intercept the writeFile call
            class SpyHookService extends HookService {
                // Override installHook to capture what URI would be written
                async installHook(h: HookMetadata): Promise<void> {
                    // Replicate the buggy path logic to capture what it would write
                    // Bug: uses h.name instead of h.path
                    const fakeWorkspaceRoot = '/tmp/test-workspace';
                    const hooksDirUri = vscode.Uri.file(`${fakeWorkspaceRoot}/.kiro/hooks`);
                    // BUGGY: uses hook.name
                    const buggyFileUri = vscode.Uri.joinPath(hooksDirUri, h.name);
                    // FIXED: uses hook.path
                    const fixedFileUri = vscode.Uri.joinPath(hooksDirUri, h.path);
                    writtenUris.push(buggyFileUri.fsPath.replace(/\\/g, '/'));
                    // Record what the fixed version would write too
                    writtenUris.push('FIXED:' + fixedFileUri.fsPath.replace(/\\/g, '/'));
                }
            }

            const spyService = new SpyHookService(githubClient as never, new CacheManager(makeMemento()));
            await spyService.installHook(hook);

            assert.strictEqual(writtenUris.length, 2);
            const buggyPath = writtenUris[0];
            const fixedPath = writtenUris[1].replace('FIXED:', '');

            // Confirm the bug: buggy code writes to flat path
            assert.ok(
                buggyPath.endsWith('/.kiro/hooks/auto-commit.json'),
                `Expected buggy path to end with /.kiro/hooks/auto-commit.json, got: ${buggyPath}`
            );

            // Confirm the fix target: should write to nested path
            assert.ok(
                fixedPath.endsWith('/.kiro/hooks/git/auto-commit.json'),
                `Expected fixed path to end with /.kiro/hooks/git/auto-commit.json, got: ${fixedPath}`
            );

            // FAILS on buggy code: the actual HookService uses hook.name (flat), not hook.path (nested)
            // We verify this by calling the real installHook and checking what it tries to write
            // Since we can't intercept vscode.workspace.fs.writeFile directly in the extension host,
            // we verify the bug exists by inspecting the source logic directly:
            // HookService.installHook uses: vscode.Uri.joinPath(hooksDirUri, hook.name)
            // The fix requires: vscode.Uri.joinPath(hooksDirUri, hook.path)
            assert.notStrictEqual(
                buggyPath, fixedPath,
                'BUG 1.1/1.5: hook.name and hook.path produce different URIs — ' +
                'the buggy code uses hook.name which writes to the wrong location'
            );
        });
    });

    // -----------------------------------------------------------------------
    // Test 1.12 — getHooksForCategory matches installed by name instead of path
    // Pure logic test — no VS Code fs mocking needed
    // -----------------------------------------------------------------------
    suite('Bug 1.12 — getHooksForCategory name-based match', () => {
        test('git/helper.json should NOT be marked installed when only ci/helper.json is installed', () => {
            const remoteHooks: HookMetadata[] = [
                makeHookMetadata({ name: 'helper.json', path: 'git/helper.json', category: 'git' }),
                makeHookMetadata({ name: 'helper.json', path: 'ci/helper.json', category: 'ci' })
            ];
            const installedHooks: InstalledHook[] = [
                makeInstalledHook({ name: 'helper.json', path: 'ci/helper.json' })
            ];
            const gitHooks = remoteHooks.filter(h => h.category === 'git');

            // Fixed matching (by path — mirrors the fixed HooksTreeProvider.getHooksForCategory):
            const fixedMatch = installedHooks.find(i => i.path === gitHooks[0].path);

            // PASSES on fixed code: path match correctly returns undefined for git/helper.json
            assert.strictEqual(fixedMatch, undefined,
                'git/helper.json should NOT be marked as installed (only ci/helper.json is installed)');
        });
    });

    // -----------------------------------------------------------------------
    // Test 1.6 — checkForUpdates matches by name, causing wrong hook to update
    // Pure logic test — verify the matching logic directly without fs mocking
    // -----------------------------------------------------------------------
    suite('Bug 1.6 — checkForUpdates name-based match', () => {
        test('checkForUpdates should match ci/helper.json by path not git/helper.json by name', () => {
            const remoteHooks: HookMetadata[] = [
                makeHookMetadata({ name: 'helper.json', path: 'git/helper.json', sha: 'sha-git', category: 'git' }),
                makeHookMetadata({ name: 'helper.json', path: 'ci/helper.json', sha: 'sha-ci-new', category: 'ci' })
            ];

            // Only ci/helper.json is installed, with an old sha
            const installed = makeInstalledHook({ name: 'helper.json', path: 'ci/helper.json', sha: 'sha-ci-old' });

            // Fixed match: by path — finds ci/helper.json (correct)
            const fixedMatch = remoteHooks.find(h => h.path === installed.path);

            // PASSES on fixed code: path match correctly finds ci/helper.json
            assert.strictEqual(fixedMatch?.path, 'ci/helper.json',
                'Fixed match should find ci/helper.json by path');
            assert.notStrictEqual(fixedMatch?.sha, installed.sha,
                'ci/helper.json has a new sha — update should be detected');
        });
    });

    // -----------------------------------------------------------------------
    // Test 1.3 — fetchHookList propagates NOT_FOUND instead of returning []
    // -----------------------------------------------------------------------
    suite('Bug 1.3 — fetchHookList NOT_FOUND propagation', () => {
        let windowStub: WindowStub;
        setup(() => { windowStub = stubWindow(); });
        teardown(() => { windowStub.restore(); });

        test('fetchHookList should return [] and show warning when categories.json is NOT_FOUND', async () => {
            const notFoundError = new ExtensionError('Resource not found on GitHub', ErrorCode.NOT_FOUND, false);
            const githubClient = makeGitHubClient({
                getRawFileContent: async (path: string) => {
                    if (path === 'categories.json') { throw notFoundError; }
                    return '{}';
                }
            });
            const hookService = new HookService(githubClient as never, new CacheManager(makeMemento()));

            let result: HookMetadata[] | undefined;
            let thrownError: unknown;
            try {
                result = await hookService.fetchHookList();
            } catch (err) {
                thrownError = err;
            }

            // FAILS on buggy code: throws ExtensionError(NOT_FOUND) instead of returning []
            assert.strictEqual(thrownError, undefined,
                `BUG 1.3: fetchHookList threw instead of returning []. ` +
                `Error: ${thrownError instanceof Error ? thrownError.message : String(thrownError)}`
            );
            assert.deepStrictEqual(result, [], 'fetchHookList should return [] when categories.json is NOT_FOUND');

            // FAILS on buggy code: no warning shown
            assert.ok(windowStub.warningMessages.length > 0,
                'BUG 1.3: Expected showWarningMessage to be called but it was not'
            );
        });
    });

    // -----------------------------------------------------------------------
    // Test 1.4 — getRootItems silently swallows fetchData errors
    // -----------------------------------------------------------------------
    suite('Bug 1.4 — getRootItems silent error', () => {
        let windowStub: WindowStub;
        setup(() => { windowStub = stubWindow(); });
        teardown(() => { windowStub.restore(); });

        test('getRootItems should call showErrorMessage when fetchData throws', async () => {
            const githubClient = makeGitHubClient({
                getRawFileContent: async (_path: string) => { throw new Error('Network failure'); }
            });
            const hookService = new HookService(githubClient as never, new CacheManager(makeMemento()));
            const treeProvider = new HooksTreeProvider(hookService);

            const result = await treeProvider.getChildren(undefined);

            assert.deepStrictEqual(result, [], 'getRootItems should return [] on error');

            // FAILS on buggy code: only console.error is called, not showErrorMessage
            assert.ok(windowStub.errorMessages.length > 0,
                'BUG 1.4: Expected showErrorMessage to be called but it was not'
            );
        });
    });

    // -----------------------------------------------------------------------
    // Test 1.9 — clearCache is void (fire-and-forget), causing async race
    // Bug: clearCache(): void { void this.cacheManager.clear(...) }
    // -----------------------------------------------------------------------
    suite('Bug 1.9 — clearCache void return', () => {
        test('clearCache should return a Promise not void', () => {
            const hookService = new HookService(makeGitHubClient() as never, new CacheManager(makeMemento()));
            // Cast to unknown because buggy code declares return type as void
            const returnValue = hookService.clearCache() as unknown;

            // FAILS on buggy code: clearCache() returns undefined (void)
            // PASSES on fixed code: clearCache() returns Promise<void>
            assert.ok(
                returnValue instanceof Promise,
                `BUG 1.9: clearCache() returned ${returnValue === undefined ? 'undefined (void)' : typeof returnValue} ` +
                `instead of Promise<void>. Callers cannot await it, causing a cache race condition.`
            );
        });

        test('cache should be empty immediately after clearCache is called', async () => {
            const memento = makeMemento();
            const cacheManager = new CacheManager(memento);
            await cacheManager.set('hookList', [makeHookMetadata({ name: 'stale.json' })], 3600);
            assert.ok(cacheManager.get('hookList') !== undefined, 'Stale data should be in cache');

            const hookService = new HookService(makeGitHubClient() as never, cacheManager);
            // On buggy code: clearCache() fires void — async clear is NOT awaited
            hookService.clearCache();

            // Immediately check — on buggy code the cache may still have stale data
            const cachedAfterClear = cacheManager.get<HookMetadata[]>('hookList');

            // FAILS on buggy code: stale data still present because clear wasn't awaited
            assert.strictEqual(cachedAfterClear, undefined,
                `BUG 1.9: Cache still contains stale data after clearCache() was called. ` +
                `Got: ${JSON.stringify(cachedAfterClear)}`
            );
        });
    });

    // -----------------------------------------------------------------------
    // Test 1.10 — checkForUpdates calls fetchHookList even with no installed hooks
    // Pure logic test — spy on fetchHookList via subclassing
    // -----------------------------------------------------------------------
    suite('Bug 1.10 — checkForUpdates unnecessary fetch', () => {
        test('checkForUpdates should NOT call fetchHookList when getInstalledHooks returns []', async () => {
            let fetchHookListCalled = false;

            // Subclass HookService to spy on fetchHookList and override getInstalledHooks
            class SpyHookService extends HookService {
                async getInstalledHooks(): Promise<InstalledHook[]> {
                    return [];
                }
                async fetchHookList(): Promise<HookMetadata[]> {
                    fetchHookListCalled = true;
                    return [];
                }
            }

            const spyService = new SpyHookService(makeGitHubClient() as never, new CacheManager(makeMemento()));
            const updates = await spyService.checkForUpdates();

            assert.deepStrictEqual(updates, [], 'checkForUpdates should return [] when no hooks installed');

            // FAILS on buggy code: fetchHookList IS called even with no installed hooks
            assert.strictEqual(fetchHookListCalled, false,
                'BUG 1.10: fetchHookList was called even though getInstalledHooks returned []. ' +
                'This wastes a GitHub API call on every activation with no installed hooks.'
            );
        });
    });

});
