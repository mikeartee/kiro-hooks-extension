Sub-issue of #11. Depends on #13 (WorkspaceAnalysisCache).

## Problem

With workspace context available, we need a service that scores hooks against it and an orchestrator that ties everything together into a ranked recommendation list.

## Work

**Create `src/services/HookMatcher.ts`**:

```typescript
export class HookMatcher {
    scoreHook(hook: HookMetadata, context: WorkspaceContext): ScoredHook {
        // Score using SCORING_WEIGHTS:
        // - FRAMEWORK_MATCH (30): hook.tags includes a detected framework name
        // - DEPENDENCY_MATCH (20): hook.tags includes a detected dependency name
        // - FILE_PATTERN_MATCH (15): hook.tags matches a detected file pattern keyword
        // - LANGUAGE_MATCH (10): hook.tags includes a detected language
        // - EVENT_TYPE_MATCH (10): hook.eventType is relevant to project type
        //   e.g. fileEdited/fileCreated hooks score for any project
        //   postTaskExecution hooks score higher for projects with tests
    }

    rankHooks(hooks: HookMetadata[], context: WorkspaceContext): ScoredHook[] {
        // Score all hooks, filter out score=0, sort descending by score
    }
}
```

**Create `src/services/RecommendationService.ts`**:

```typescript
export interface RecommendationOptions {
    maxResults?: number;
    includeInstalled?: boolean;
    minScore?: number;
}

export class RecommendationService {
    constructor(
        private readonly hookService: HookService,
        private readonly workspaceAnalysisCache: WorkspaceAnalysisCache,
        private readonly hookMatcher: HookMatcher
    ) {}

    async getRecommendations(options?: RecommendationOptions): Promise<ScoredHook[]> {
        // 1. Get workspace folder, throw if none
        // 2. Analyze workspace via cache
        // 3. Get installed hooks, add to context.installedHooks
        // 4. Fetch hook list via hookService
        // 5. Score and rank via hookMatcher
        // 6. Filter by minScore (default 10), exclude installed if !includeInstalled
        // 7. Limit to maxResults (default 10)
        // 8. Return
    }
}
```

**Add unit tests** in `src/test/suite/hookMatcher.test.ts` covering:
- Framework match: hook with tag "typescript" scores against TypeScript workspace
- Dependency match: hook with tag "eslint" scores against workspace with eslint dependency
- Language match: hook with tag "python" scores against Python workspace
- No match: hook with tag "go" scores 0 against TypeScript workspace
- Already-installed hooks are flagged correctly

## Acceptance criteria

- `HookMatcher.rankHooks()` returns hooks sorted by score descending
- Hooks with no matching signals score 0 and are excluded from results
- `RecommendationService.getRecommendations()` returns at most `maxResults` results above `minScore`
- All unit tests pass
