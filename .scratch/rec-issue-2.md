Sub-issue of #11. Depends on #12 (Types + WorkspaceAnalyzer).

## Problem

Running workspace analysis on every recommendation request re-scans the filesystem unnecessarily. A TTL-based cache prevents redundant scans within the same session.

## Work

**Create `src/services/WorkspaceAnalysisCache.ts`** — port from the steering docs extension's `WorkspaceAnalysisCache.ts`:

```typescript
export class WorkspaceAnalysisCache {
    private cache: WorkspaceContext | null = null;
    private cacheTime: number = 0;
    private readonly ttlMs: number;

    constructor(
        private readonly analyzer: WorkspaceAnalyzer,
        ttlSeconds: number = 300  // 5 minutes default
    ) {
        this.ttlMs = ttlSeconds * 1000;
    }

    async analyze(workspaceRoot: string): Promise<WorkspaceContext> {
        const now = Date.now();
        if (this.cache && (now - this.cacheTime) < this.ttlMs) {
            return this.cache;
        }
        this.cache = await this.analyzer.analyze(workspaceRoot);
        this.cacheTime = now;
        return this.cache;
    }

    invalidate(): void {
        this.cache = null;
        this.cacheTime = 0;
    }
}
```

**Wire cache invalidation**: In `HookService.clearCache()`, also call `workspaceAnalysisCache.invalidate()` if one is available. The cleanest approach is to pass the cache to `HookService` as an optional constructor parameter, or expose an `invalidate()` call from `extension.ts` when refresh is triggered.

**Add unit tests** in `src/test/suite/workspaceAnalysisCache.test.ts` covering:
- Cache hit (second call within TTL returns same object without calling analyzer)
- Cache miss (first call always hits analyzer)
- TTL expiry (call after TTL re-runs analyzer)
- `invalidate()` forces re-analysis on next call

## Acceptance criteria

- Two consecutive `analyze()` calls within 5 minutes only invoke `WorkspaceAnalyzer.analyze()` once
- After `invalidate()`, the next call re-runs the analyzer
- All unit tests pass
