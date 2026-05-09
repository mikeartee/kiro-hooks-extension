// Internal modules
import { WorkspaceAnalyzer } from './WorkspaceAnalyzer';
import { WorkspaceContext } from '../models/types';

/**
 * TTL-based in-memory cache for workspace analysis results.
 * Prevents redundant filesystem scans on repeated recommendation requests.
 */
export class WorkspaceAnalysisCache {
    private cache: WorkspaceContext | null = null;
    private cacheTime: number = 0;
    private readonly ttlMs: number;

    constructor(
        private readonly analyzer: WorkspaceAnalyzer,
        ttlSeconds: number = 300
    ) {
        this.ttlMs = ttlSeconds * 1000;
    }

    /**
     * Analyze the workspace, returning cached result if within TTL.
     * @param workspaceRoot Absolute path to the workspace root
     * @returns WorkspaceContext (cached or freshly analyzed)
     */
    async analyze(workspaceRoot: string): Promise<WorkspaceContext> {
        const now = Date.now();
        if (this.cache !== null && (now - this.cacheTime) < this.ttlMs) {
            console.log('[WorkspaceAnalysisCache] Returning cached workspace context');
            return this.cache;
        }
        console.log('[WorkspaceAnalysisCache] Cache miss — running fresh analysis');
        this.cache = await this.analyzer.analyze(workspaceRoot);
        this.cacheTime = now;
        return this.cache;
    }

    /**
     * Invalidate the cache, forcing re-analysis on the next call.
     */
    invalidate(): void {
        this.cache = null;
        this.cacheTime = 0;
        console.log('[WorkspaceAnalysisCache] Cache invalidated');
    }
}
