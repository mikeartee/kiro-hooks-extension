// External libraries
import * as vscode from 'vscode';

// Internal modules
import { HookService } from './HookService';
import { WorkspaceAnalysisCache } from './WorkspaceAnalysisCache';
import { HookMatcher } from './HookMatcher';
import { ScoredHook } from '../models/types';

export interface RecommendationOptions {
    maxResults?: number;
    includeInstalled?: boolean;
    minScore?: number;
}

/**
 * Service for generating hook recommendations based on workspace context.
 * Orchestrates HookService, WorkspaceAnalysisCache, and HookMatcher.
 */
export class RecommendationService {
    constructor(
        private readonly hookService: HookService,
        private readonly workspaceAnalysisCache: WorkspaceAnalysisCache,
        private readonly hookMatcher: HookMatcher
    ) {}

    /**
     * Returns ranked hook recommendations for the current workspace.
     * @param options Optional filtering and pagination options
     * @returns Filtered, ranked list of scored hooks
     */
    async getRecommendations(options?: RecommendationOptions): Promise<ScoredHook[]> {
        const opts = {
            maxResults: options?.maxResults ?? 10,
            includeInstalled: options?.includeInstalled ?? false,
            minScore: options?.minScore ?? 10
        };

        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            return [];
        }

        // Get workspace context (cached)
        const context = await this.workspaceAnalysisCache.analyze(workspaceFolder.uri.fsPath);

        // Get installed hooks and add to context
        const installedHooks = await this.hookService.getInstalledHooks();
        context.installedHooks = installedHooks.map(h => h.name);

        // Fetch hook list
        const hooks = await this.hookService.fetchHookList();

        // Score and rank
        const scored = this.hookMatcher.rankHooks(hooks, context);

        // Filter by minimum score
        let filtered = scored.filter(s => s.score >= opts.minScore);

        // Optionally exclude already-installed hooks
        if (!opts.includeInstalled) {
            filtered = filtered.filter(s => !s.isInstalled);
        }

        // Limit results
        if (filtered.length > opts.maxResults) {
            filtered = filtered.slice(0, opts.maxResults);
        }

        return filtered;
    }
}
