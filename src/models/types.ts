/**
 * Hook event types supported by Kiro
 */
export type HookEventType =
    | 'fileEdited'
    | 'fileCreated'
    | 'fileDeleted'
    | 'userTriggered'
    | 'promptSubmit'
    | 'agentStop'
    | 'preToolUse'
    | 'postToolUse'
    | 'preTaskExecution'
    | 'postTaskExecution';

/**
 * Hook action types
 */
export type HookActionType = 'askAgent' | 'runCommand';

/**
 * The "when" condition of a hook
 */
export interface HookWhen {
    type: HookEventType;
    patterns?: string[];
    toolTypes?: string[];
}

/**
 * The "then" action of a hook
 */
export interface HookThen {
    type: HookActionType;
    prompt?: string;
    command?: string;
}

/**
 * The canonical Kiro hook schema (JSON format, lives in .kiro/hooks/)
 */
export interface KiroHookSchema {
    name: string;
    version: string;
    description?: string;
    enabled?: boolean;
    tags?: string[];
    when: HookWhen;
    then: HookThen;
}

/**
 * Metadata about a hook from the GitHub repository
 */
export interface HookMetadata {
    name: string;
    path: string;
    category: string;
    version: string;
    description: string;
    sha: string;
    size: number;
    downloadUrl: string;
    eventType: HookEventType;
    actionType: HookActionType;
    tags?: string[];
}

/**
 * Information about an installed hook
 */
export interface InstalledHook {
    name: string;
    path: string;
    version: string;
    installedAt: Date;
    sha: string;
}

/**
 * Update information for a hook
 */
export interface HookUpdateInfo {
    hook: HookMetadata;
    currentVersion: string;
    newVersion: string;
}

/**
 * Category definition from categories.json
 */
export interface CategoryDefinition {
    id: string;
    label: string;
    description: string;
}

/**
 * GitHub API content response
 */
export interface GitHubContent {
    name: string;
    path: string;
    sha: string;
    size: number;
    url: string;
    html_url: string;
    git_url: string;
    download_url: string;
    type: 'file' | 'dir';
    content?: string;
    encoding?: string;
}

/**
 * Error codes for extension errors
 */
export enum ErrorCode {
    NETWORK_ERROR = 'NETWORK_ERROR',
    FILE_SYSTEM_ERROR = 'FILE_SYSTEM_ERROR',
    PARSE_ERROR = 'PARSE_ERROR',
    NOT_FOUND = 'NOT_FOUND'
}

/**
 * Custom error class for extension errors
 */
export class ExtensionError extends Error {
    constructor(
        message: string,
        public readonly code: ErrorCode,
        public readonly recoverable: boolean
    ) {
        super(message);
        this.name = 'ExtensionError';
    }
}

/**
 * Token management types
 */
export enum TokenType {
    FINE_GRAINED = 'fine-grained',
    CLASSIC = 'classic',
    OAUTH = 'oauth',
    GITHUB_ACTIONS = 'github-actions',
    UNKNOWN = 'unknown'
}

export interface TokenInfo {
    hasToken: boolean;
    tokenType?: TokenType;
    isValid?: boolean;
    username?: string;
    error?: string;
    source?: 'secretStorage' | 'settings' | 'none';
}

// ============================================================================
// Recommendation System Types
// ============================================================================

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
    readonly name: string;
    readonly version: string;
    readonly confidence: number;
}

export interface DependencyInfo {
    readonly name: string;
    readonly version: string;
    readonly isDev: boolean;
    readonly category: DependencyCategory;
}

export interface FilePattern {
    readonly pattern: string;
    readonly count: number;
    readonly significance: number;
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
    readonly type: 'framework' | 'dependency' | 'file-pattern' | 'language' | 'project-type' | 'event-type';
    readonly description: string;
    readonly weight: number;
    readonly details: string[];
}

export interface ScoredHook {
    readonly hook: HookMetadata;
    readonly score: number;
    readonly reasons: MatchReason[];
    readonly isInstalled: boolean;
}

export const SCORING_WEIGHTS = {
    FRAMEWORK_MATCH: 30,
    DEPENDENCY_MATCH: 20,
    FILE_PATTERN_MATCH: 15,
    LANGUAGE_MATCH: 10,
    EVENT_TYPE_MATCH: 10
} as const;
