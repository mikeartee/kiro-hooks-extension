// Internal modules
import {
    HookMetadata,
    WorkspaceContext,
    ScoredHook,
    MatchReason,
    FrameworkInfo,
    DependencyInfo,
    SCORING_WEIGHTS
} from '../models/types';

/**
 * Service for scoring and ranking hooks based on workspace context.
 * Adapted from DocumentMatcher with hook-specific scoring logic.
 */
export class HookMatcher {
    /**
     * Scores a single hook based on workspace context.
     * @param hook Hook to score
     * @param context Workspace context
     * @returns Scored hook with reasons
     */
    scoreHook(hook: HookMetadata, context: WorkspaceContext): ScoredHook {
        const reasons: MatchReason[] = [];
        let totalScore = 0;

        // Calculate framework score (tag matches detected framework name)
        const frameworkResult = this.calculateFrameworkScore(hook, context.frameworks);
        if (frameworkResult.score > 0) {
            totalScore += frameworkResult.score;
            reasons.push(...frameworkResult.reasons);
        }

        // Calculate dependency score (tag matches detected dependency name)
        const dependencyResult = this.calculateDependencyScore(hook, context.dependencies);
        if (dependencyResult.score > 0) {
            totalScore += dependencyResult.score;
            reasons.push(...dependencyResult.reasons);
        }

        // Calculate language score (tag matches detected language)
        const languageResult = this.calculateLanguageScore(hook, context.languages);
        if (languageResult.score > 0) {
            totalScore += languageResult.score;
            reasons.push(...languageResult.reasons);
        }

        // Calculate event type score
        const eventTypeResult = this.calculateEventTypeScore(hook, context);
        if (eventTypeResult.score > 0) {
            totalScore += eventTypeResult.score;
            reasons.push(...eventTypeResult.reasons);
        }

        // Check if hook is installed
        const isInstalled = context.installedHooks.includes(hook.name);

        return {
            hook,
            score: totalScore,
            reasons,
            isInstalled
        };
    }

    /**
     * Ranks multiple hooks based on workspace context.
     * Filters out hooks with score = 0, sorts by score descending then alphabetically.
     * @param hooks Hooks to rank
     * @param context Workspace context
     * @returns Sorted array of scored hooks (score > 0 only)
     */
    rankHooks(hooks: HookMetadata[], context: WorkspaceContext): ScoredHook[] {
        // Score all hooks
        const scored = hooks.map(hook => this.scoreHook(hook, context));

        // Filter out hooks with no matches
        const withMatches = scored.filter(s => s.score > 0);

        // Sort by score descending, then alphabetically by name
        withMatches.sort((a, b) => {
            if (b.score !== a.score) {
                return b.score - a.score;
            }
            return a.hook.name.localeCompare(b.hook.name);
        });

        return withMatches;
    }

    /**
     * Calculates score based on framework matches.
     * hook.tags includes a detected framework name → FRAMEWORK_MATCH (30) per match.
     */
    private calculateFrameworkScore(
        hook: HookMetadata,
        frameworks: FrameworkInfo[]
    ): { score: number; reasons: MatchReason[] } {
        const reasons: MatchReason[] = [];
        let score = 0;

        if (!hook.tags || hook.tags.length === 0 || frameworks.length === 0) {
            return { score, reasons };
        }

        const matchedFrameworks: string[] = [];

        for (const framework of frameworks) {
            const normalizedFrameworkName = framework.name.toLowerCase();
            const hasMatch = hook.tags.some(tag =>
                tag.toLowerCase() === normalizedFrameworkName ||
                tag.toLowerCase().includes(normalizedFrameworkName)
            );

            if (hasMatch) {
                matchedFrameworks.push(framework.name);
                score += SCORING_WEIGHTS.FRAMEWORK_MATCH;
            }
        }

        if (matchedFrameworks.length > 0) {
            reasons.push({
                type: 'framework',
                description: `Matches your ${matchedFrameworks.join(', ')} framework${matchedFrameworks.length > 1 ? 's' : ''}`,
                weight: SCORING_WEIGHTS.FRAMEWORK_MATCH,
                details: matchedFrameworks
            });
        }

        return { score, reasons };
    }

    /**
     * Calculates score based on dependency matches.
     * hook.tags includes a detected dependency name → DEPENDENCY_MATCH (20) per match.
     */
    private calculateDependencyScore(
        hook: HookMetadata,
        dependencies: DependencyInfo[]
    ): { score: number; reasons: MatchReason[] } {
        const reasons: MatchReason[] = [];
        let score = 0;

        if (!hook.tags || hook.tags.length === 0 || dependencies.length === 0) {
            return { score, reasons };
        }

        const matchedDependencies: string[] = [];
        const depNames = dependencies.map(d => d.name.toLowerCase());

        for (const tag of hook.tags) {
            const normalizedTag = tag.toLowerCase();
            const hasMatch = depNames.some(depName =>
                depName === normalizedTag ||
                depName.includes(normalizedTag) ||
                normalizedTag.includes(depName)
            );

            if (hasMatch) {
                matchedDependencies.push(tag);
                score += SCORING_WEIGHTS.DEPENDENCY_MATCH;
            }
        }

        if (matchedDependencies.length > 0) {
            reasons.push({
                type: 'dependency',
                description: `Uses ${matchedDependencies.join(', ')} from your dependencies`,
                weight: SCORING_WEIGHTS.DEPENDENCY_MATCH,
                details: matchedDependencies
            });
        }

        return { score, reasons };
    }

    /**
     * Calculates score based on language matches.
     * hook.tags includes a detected language → LANGUAGE_MATCH (10) per match.
     */
    private calculateLanguageScore(
        hook: HookMetadata,
        languages: string[]
    ): { score: number; reasons: MatchReason[] } {
        const reasons: MatchReason[] = [];
        let score = 0;

        if (!hook.tags || hook.tags.length === 0 || languages.length === 0) {
            return { score, reasons };
        }

        const matchedLanguages: string[] = [];
        const normalizedLanguages = languages.map(l => l.toLowerCase());

        for (const tag of hook.tags) {
            const normalizedTag = tag.toLowerCase();
            if (normalizedLanguages.includes(normalizedTag)) {
                matchedLanguages.push(tag);
                score += SCORING_WEIGHTS.LANGUAGE_MATCH;
            }
        }

        if (matchedLanguages.length > 0) {
            reasons.push({
                type: 'language',
                description: `Relevant for ${matchedLanguages.join(', ')} development`,
                weight: SCORING_WEIGHTS.LANGUAGE_MATCH,
                details: matchedLanguages
            });
        }

        return { score, reasons };
    }

    /**
     * Calculates score based on event type relevance.
     * - fileEdited/fileCreated/fileDeleted → EVENT_TYPE_MATCH (10) for any project
     * - postTaskExecution → EVENT_TYPE_MATCH (10) for projects with tests
     */
    private calculateEventTypeScore(
        hook: HookMetadata,
        context: WorkspaceContext
    ): { score: number; reasons: MatchReason[] } {
        const reasons: MatchReason[] = [];
        let score = 0;

        const fileEventTypes = new Set<string>(['fileEdited', 'fileCreated', 'fileDeleted']);

        if (fileEventTypes.has(hook.eventType)) {
            score += SCORING_WEIGHTS.EVENT_TYPE_MATCH;
            reasons.push({
                type: 'event-type',
                description: `Triggers on file changes (${hook.eventType})`,
                weight: SCORING_WEIGHTS.EVENT_TYPE_MATCH,
                details: [hook.eventType]
            });
        } else if (hook.eventType === 'postTaskExecution' && context.hasTests) {
            score += SCORING_WEIGHTS.EVENT_TYPE_MATCH;
            reasons.push({
                type: 'event-type',
                description: 'Runs after task execution — useful for projects with tests',
                weight: SCORING_WEIGHTS.EVENT_TYPE_MATCH,
                details: [hook.eventType]
            });
        }

        return { score, reasons };
    }
}
