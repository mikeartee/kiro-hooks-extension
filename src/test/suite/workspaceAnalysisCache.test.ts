import * as assert from 'assert';
import { WorkspaceAnalysisCache } from '../../services/WorkspaceAnalysisCache';
import { WorkspaceContext, ProjectType } from '../../models/types';

function makeContext(override?: Partial<WorkspaceContext>): WorkspaceContext {
    return {
        languages: ['typescript'],
        frameworks: [],
        dependencies: [],
        filePatterns: [],
        hasTests: false,
        projectType: ProjectType.UNKNOWN,
        installedHooks: [],
        ...override
    };
}

function makeAnalyzer(context: WorkspaceContext): { analyze: (root: string) => Promise<WorkspaceContext>; callCount: number } {
    const stub = {
        callCount: 0,
        async analyze(_root: string): Promise<WorkspaceContext> {
            stub.callCount++;
            return context;
        }
    };
    return stub;
}

suite('WorkspaceAnalysisCache', () => {
    test('cache miss on first call — calls analyzer', async () => {
        const ctx = makeContext();
        const analyzer = makeAnalyzer(ctx);
        const cache = new WorkspaceAnalysisCache(analyzer as never);
        const result = await cache.analyze('/workspace');
        assert.strictEqual(analyzer.callCount, 1);
        assert.deepStrictEqual(result, ctx);
    });

    test('cache hit on second call within TTL — does not call analyzer again', async () => {
        const ctx = makeContext();
        const analyzer = makeAnalyzer(ctx);
        const cache = new WorkspaceAnalysisCache(analyzer as never, 300);
        await cache.analyze('/workspace');
        await cache.analyze('/workspace');
        assert.strictEqual(analyzer.callCount, 1, 'Analyzer should only be called once within TTL');
    });

    test('cache miss after TTL expiry — calls analyzer again', async () => {
        const ctx = makeContext();
        const analyzer = makeAnalyzer(ctx);
        const cache = new WorkspaceAnalysisCache(analyzer as never, 0); // 0s TTL = always expired
        await cache.analyze('/workspace');
        await cache.analyze('/workspace');
        assert.strictEqual(analyzer.callCount, 2, 'Analyzer should be called again after TTL expiry');
    });

    test('invalidate forces re-analysis on next call', async () => {
        const ctx = makeContext();
        const analyzer = makeAnalyzer(ctx);
        const cache = new WorkspaceAnalysisCache(analyzer as never, 300);
        await cache.analyze('/workspace');
        cache.invalidate();
        await cache.analyze('/workspace');
        assert.strictEqual(analyzer.callCount, 2, 'Analyzer should be called again after invalidate');
    });
});
