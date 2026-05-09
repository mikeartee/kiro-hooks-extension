Sub-issue of #11.

## Problem

The recommendation system needs a set of shared types and a service that can analyse the current workspace to build a `WorkspaceContext` — the foundation all other recommendation components depend on.

## Work

**In `src/models/types.ts`**, add:

```typescript
export enum ProjectType {
    WEB_APP = 'web-app',
    LIBRARY = 'library',
    CLI_TOOL = 'cli-tool',
    VSCODE_EXTENSION = 'vscode-extension',
    API_SERVER = 'api-server',
    UNKNOWN = 'unknown'
}

export enum DependencyCategory {
    FRAMEWORK = 'framework',
    TESTING = 'testing',
    BUILD = 'build',
    UTILITY = 'utility'
}

export interface FrameworkInfo {
    name: string;
    version: string;
    confidence: number;
}

export interface DependencyInfo {
    name: string;
    version: string;
    isDev: boolean;
    category: DependencyCategory;
}

export interface FilePattern {
    pattern: string;
    count: number;
    significance: number;
}

export interface WorkspaceContext {
    languages: string[];
    frameworks: FrameworkInfo[];
    dependencies: DependencyInfo[];
    filePatterns: FilePattern[];
    hasTests: boolean;
    projectType: ProjectType;
    installedHooks: string[];
}

export interface MatchReason {
    type: 'framework' | 'dependency' | 'file-pattern' | 'language' | 'project-type' | 'event-type';
    description: string;
    weight: number;
    details: string[];
}

export interface ScoredHook {
    hook: HookMetadata;
    score: number;
    reasons: MatchReason[];
    isInstalled: boolean;
}

export const SCORING_WEIGHTS = {
    FRAMEWORK_MATCH: 30,
    DEPENDENCY_MATCH: 20,
    FILE_PATTERN_MATCH: 15,
    LANGUAGE_MATCH: 10,
    EVENT_TYPE_MATCH: 10
} as const;
```

**Create `src/services/WorkspaceAnalyzer.ts`** — port from the steering docs extension's `WorkspaceAnalyzer.ts` with these adaptations:
- Replace `installedDocs: string[]` with `installedHooks: string[]` in `WorkspaceContext`
- Keep all workspace scanning logic identical (package.json parsing, file structure analysis, language/project type detection)
- The `analyze(workspaceRoot)` method returns `WorkspaceContext`

## Acceptance criteria

- `WorkspaceAnalyzer.analyze()` returns a `WorkspaceContext` with correct languages, frameworks, dependencies, and project type for a TypeScript project with a `package.json`
- Returns a valid context (with empty arrays) when no `package.json` exists
- All new types compile without errors
