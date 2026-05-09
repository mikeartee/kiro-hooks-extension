import * as assert from 'assert';
import { HookMatcher } from '../../services/HookMatcher';
import {
    HookMetadata,
    WorkspaceContext,
    ProjectType,
    DependencyCategory
} from '../../models/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeHook(overrides: Partial<HookMetadata> = {}): HookMetadata {
    return {
        name: 'test-hook',
        path: 'testing/test-hook.json',
        category: 'testing',
        version: '1.0.0',
        description: 'A test hook',
        sha: 'abc123',
        size: 100,
        downloadUrl: 'https://example.com/test-hook.json',
        eventType: 'userTriggered',
        actionType: 'runCommand',
        tags: [],
        ...overrides
    };
}

function makeContext(overrides: Partial<WorkspaceContext> = {}): WorkspaceContext {
    return {
        languages: [],
        frameworks: [],
        dependencies: [],
        filePatterns: [],
        hasTests: false,
        projectType: ProjectType.UNKNOWN,
        installedHooks: [],
        ...overrides
    };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

suite('HookMatcher', () => {
    let matcher: HookMatcher;

    setup(() => {
        matcher = new HookMatcher();
    });

    // -----------------------------------------------------------------------
    // Framework scoring
    // -----------------------------------------------------------------------

    test('framework match: hook tag matches detected framework → FRAMEWORK_MATCH score', () => {
        const hook = makeHook({ tags: ['typescript'] });
        const context = makeContext({
            frameworks: [{ name: 'typescript', version: '5.0.0', confidence: 1.0 }]
        });

        const result = matcher.scoreHook(hook, context);

        assert.strictEqual(result.score, 30, 'Should score FRAMEWORK_MATCH (30)');
        assert.ok(result.reasons.some(r => r.type === 'framework'), 'Should have a framework reason');
    });

    test('framework match: hook tag includes framework name (partial) → FRAMEWORK_MATCH score', () => {
        const hook = makeHook({ tags: ['react-typescript'] });
        const context = makeContext({
            frameworks: [{ name: 'typescript', version: '5.0.0', confidence: 1.0 }]
        });

        const result = matcher.scoreHook(hook, context);

        assert.strictEqual(result.score, 30, 'Partial tag match should score FRAMEWORK_MATCH (30)');
    });

    test('framework match: multiple framework matches accumulate score', () => {
        const hook = makeHook({ tags: ['react', 'typescript'] });
        const context = makeContext({
            frameworks: [
                { name: 'react', version: '18.0.0', confidence: 1.0 },
                { name: 'typescript', version: '5.0.0', confidence: 1.0 }
            ]
        });

        const result = matcher.scoreHook(hook, context);

        assert.strictEqual(result.score, 60, 'Two framework matches should score 60');
    });

    // -----------------------------------------------------------------------
    // Dependency scoring
    // -----------------------------------------------------------------------

    test('dependency match: hook tag matches detected dependency → DEPENDENCY_MATCH score', () => {
        const hook = makeHook({ tags: ['eslint'] });
        const context = makeContext({
            dependencies: [{
                name: 'eslint',
                version: '8.0.0',
                isDev: true,
                category: DependencyCategory.BUILD
            }]
        });

        const result = matcher.scoreHook(hook, context);

        assert.strictEqual(result.score, 20, 'Should score DEPENDENCY_MATCH (20)');
        assert.ok(result.reasons.some(r => r.type === 'dependency'), 'Should have a dependency reason');
    });

    test('dependency match: multiple tag-to-dependency matches accumulate score', () => {
        const hook = makeHook({ tags: ['eslint', 'prettier'] });
        const context = makeContext({
            dependencies: [
                { name: 'eslint', version: '8.0.0', isDev: true, category: DependencyCategory.BUILD },
                { name: 'prettier', version: '3.0.0', isDev: true, category: DependencyCategory.BUILD }
            ]
        });

        const result = matcher.scoreHook(hook, context);

        assert.strictEqual(result.score, 40, 'Two dependency matches should score 40');
    });

    // -----------------------------------------------------------------------
    // Language scoring
    // -----------------------------------------------------------------------

    test('language match: hook tag matches detected language → LANGUAGE_MATCH score', () => {
        const hook = makeHook({ tags: ['python'] });
        const context = makeContext({ languages: ['python'] });

        const result = matcher.scoreHook(hook, context);

        assert.strictEqual(result.score, 10, 'Should score LANGUAGE_MATCH (10)');
        assert.ok(result.reasons.some(r => r.type === 'language'), 'Should have a language reason');
    });

    test('language match: case-insensitive comparison', () => {
        const hook = makeHook({ tags: ['Python'] });
        const context = makeContext({ languages: ['python'] });

        const result = matcher.scoreHook(hook, context);

        assert.strictEqual(result.score, 10, 'Language match should be case-insensitive');
    });

    // -----------------------------------------------------------------------
    // No match
    // -----------------------------------------------------------------------

    test('no match: hook tag "go" scores 0 against TypeScript workspace', () => {
        const hook = makeHook({ tags: ['go'] });
        const context = makeContext({
            languages: ['typescript'],
            frameworks: [{ name: 'typescript', version: '5.0.0', confidence: 1.0 }],
            dependencies: [{ name: 'eslint', version: '8.0.0', isDev: true, category: DependencyCategory.BUILD }]
        });

        const result = matcher.scoreHook(hook, context);

        assert.strictEqual(result.score, 0, 'Unrelated tag should score 0');
        assert.strictEqual(result.reasons.length, 0, 'Should have no match reasons');
    });

    test('no match: hook with no tags scores 0', () => {
        const hook = makeHook({ tags: [] });
        const context = makeContext({
            languages: ['typescript'],
            frameworks: [{ name: 'react', version: '18.0.0', confidence: 1.0 }]
        });

        const result = matcher.scoreHook(hook, context);

        assert.strictEqual(result.score, 0, 'Hook with no tags should score 0');
    });

    // -----------------------------------------------------------------------
    // Event type scoring
    // -----------------------------------------------------------------------

    test('event type: fileEdited hook scores EVENT_TYPE_MATCH for any project', () => {
        const hook = makeHook({ eventType: 'fileEdited', tags: [] });
        const context = makeContext();

        const result = matcher.scoreHook(hook, context);

        assert.strictEqual(result.score, 10, 'fileEdited should score EVENT_TYPE_MATCH (10)');
        assert.ok(result.reasons.some(r => r.type === 'event-type'), 'Should have event-type reason');
    });

    test('event type: fileCreated hook scores EVENT_TYPE_MATCH for any project', () => {
        const hook = makeHook({ eventType: 'fileCreated', tags: [] });
        const context = makeContext();

        const result = matcher.scoreHook(hook, context);

        assert.strictEqual(result.score, 10, 'fileCreated should score EVENT_TYPE_MATCH (10)');
    });

    test('event type: fileDeleted hook scores EVENT_TYPE_MATCH for any project', () => {
        const hook = makeHook({ eventType: 'fileDeleted', tags: [] });
        const context = makeContext();

        const result = matcher.scoreHook(hook, context);

        assert.strictEqual(result.score, 10, 'fileDeleted should score EVENT_TYPE_MATCH (10)');
    });

    test('event type: postTaskExecution hook scores EVENT_TYPE_MATCH for project with tests', () => {
        const hook = makeHook({ eventType: 'postTaskExecution', tags: [] });
        const context = makeContext({ hasTests: true });

        const result = matcher.scoreHook(hook, context);

        assert.strictEqual(result.score, 10, 'postTaskExecution should score EVENT_TYPE_MATCH (10) when hasTests');
    });

    test('event type: postTaskExecution hook scores 0 for project without tests', () => {
        const hook = makeHook({ eventType: 'postTaskExecution', tags: [] });
        const context = makeContext({ hasTests: false });

        const result = matcher.scoreHook(hook, context);

        assert.strictEqual(result.score, 0, 'postTaskExecution should score 0 when no tests');
    });

    test('event type: userTriggered hook does not score EVENT_TYPE_MATCH', () => {
        const hook = makeHook({ eventType: 'userTriggered', tags: [] });
        const context = makeContext();

        const result = matcher.scoreHook(hook, context);

        assert.strictEqual(result.score, 0, 'userTriggered should not score EVENT_TYPE_MATCH');
    });

    // -----------------------------------------------------------------------
    // rankHooks
    // -----------------------------------------------------------------------

    test('rankHooks: returns hooks sorted by score descending', () => {
        const hookA = makeHook({ name: 'hook-a', tags: ['typescript'], eventType: 'userTriggered' });
        const hookB = makeHook({ name: 'hook-b', tags: ['typescript'], eventType: 'fileEdited' });
        const context = makeContext({
            languages: ['typescript']
        });

        const ranked = matcher.rankHooks([hookA, hookB], context);

        // hookB: language(10) + eventType(10) = 20
        // hookA: language(10) = 10
        assert.strictEqual(ranked[0].hook.name, 'hook-b', 'Higher score hook should be first');
        assert.strictEqual(ranked[1].hook.name, 'hook-a', 'Lower score hook should be second');
        assert.ok(ranked[0].score > ranked[1].score, 'Scores should be descending');
    });

    test('rankHooks: excludes hooks with score = 0', () => {
        const hookA = makeHook({ name: 'hook-a', tags: ['typescript'] });
        const hookB = makeHook({ name: 'hook-b', tags: ['go'] }); // no match
        const context = makeContext({ languages: ['typescript'] });

        const ranked = matcher.rankHooks([hookA, hookB], context);

        assert.strictEqual(ranked.length, 1, 'Should exclude zero-score hooks');
        assert.strictEqual(ranked[0].hook.name, 'hook-a');
    });

    test('rankHooks: ties broken alphabetically by name', () => {
        const hookA = makeHook({ name: 'alpha-hook', tags: ['python'] });
        const hookB = makeHook({ name: 'beta-hook', tags: ['python'] });
        const context = makeContext({ languages: ['python'] });

        const ranked = matcher.rankHooks([hookB, hookA], context);

        assert.strictEqual(ranked[0].hook.name, 'alpha-hook', 'Alphabetically first should come first on tie');
        assert.strictEqual(ranked[1].hook.name, 'beta-hook');
    });

    test('rankHooks: returns empty array when no hooks match', () => {
        const hook = makeHook({ name: 'go-hook', tags: ['go'] });
        const context = makeContext({ languages: ['typescript'] });

        const ranked = matcher.rankHooks([hook], context);

        assert.strictEqual(ranked.length, 0, 'Should return empty array when nothing matches');
    });

    // -----------------------------------------------------------------------
    // isInstalled flag
    // -----------------------------------------------------------------------

    test('isInstalled: hook is flagged as installed when its name is in context.installedHooks', () => {
        const hook = makeHook({ name: 'lint-on-save', tags: ['typescript'], eventType: 'fileEdited' });
        const context = makeContext({
            installedHooks: ['lint-on-save'],
            languages: ['typescript']
        });

        const result = matcher.scoreHook(hook, context);

        assert.strictEqual(result.isInstalled, true, 'Hook should be flagged as installed');
    });

    test('isInstalled: hook is not flagged as installed when name is absent from context.installedHooks', () => {
        const hook = makeHook({ name: 'lint-on-save', tags: ['typescript'], eventType: 'fileEdited' });
        const context = makeContext({
            installedHooks: ['other-hook'],
            languages: ['typescript']
        });

        const result = matcher.scoreHook(hook, context);

        assert.strictEqual(result.isInstalled, false, 'Hook should not be flagged as installed');
    });

    test('isInstalled: rankHooks preserves isInstalled flag', () => {
        const hook = makeHook({ name: 'lint-on-save', tags: ['typescript'], eventType: 'fileEdited' });
        const context = makeContext({
            installedHooks: ['lint-on-save'],
            languages: ['typescript']
        });

        const ranked = matcher.rankHooks([hook], context);

        assert.strictEqual(ranked.length, 1);
        assert.strictEqual(ranked[0].isInstalled, true, 'rankHooks should preserve isInstalled flag');
    });
});
