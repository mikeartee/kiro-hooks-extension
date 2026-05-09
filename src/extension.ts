// External libraries
import * as vscode from 'vscode';

// Internal modules
import { GitHubClient } from './services/GitHubClient';
import { CacheManager } from './services/CacheManager';
import { HookService } from './services/HookService';
import { TokenManager } from './services/TokenManager';
import { WorkspaceAnalyzer } from './services/WorkspaceAnalyzer';
import { WorkspaceAnalysisCache } from './services/WorkspaceAnalysisCache';
import { HookMatcher } from './services/HookMatcher';
import { RecommendationService } from './services/RecommendationService';
import { HooksTreeProvider } from './providers/HooksTreeProvider';
import { HookContentProvider, HOOK_SCHEME } from './providers/HookContentProvider';
import { registerCommands, performUpdateCheck } from './commands';

export function activate(context: vscode.ExtensionContext): void {
    console.log('Kiro Hooks Browser is now active');

    const config = vscode.workspace.getConfiguration('kiroHooks');
    const repository = config.get<string>('repository', 'mikeartee/kiro-hooks-docs');
    const branch = config.get<string>('branch', 'main');

    const tokenManager = new TokenManager(context.secrets, context.subscriptions, context.secrets.onDidChange);
    const githubClient = new GitHubClient(repository, branch, () => tokenManager.getToken());
    const cacheManager = new CacheManager(context.globalState);
    const cacheTimeout = config.get<number>('cacheTimeout', 3600);
    const hookService = new HookService(githubClient, cacheManager, cacheTimeout);
    const treeProvider = new HooksTreeProvider(hookService);

    const workspaceAnalyzer = new WorkspaceAnalyzer();
    const workspaceAnalysisCache = new WorkspaceAnalysisCache(workspaceAnalyzer);
    const hookMatcher = new HookMatcher();
    const recommendationService = new RecommendationService(hookService, workspaceAnalysisCache, hookMatcher);

    // Migrate flat-installed hooks to path-based layout (one-time, silent)
    void hookService.migrateInstalledHooks().catch((err: unknown) => {
        console.error('Hook migration failed:', err);
    });

    const hookContentProvider = new HookContentProvider(hookService);
    context.subscriptions.push(
        vscode.workspace.registerTextDocumentContentProvider(HOOK_SCHEME, hookContentProvider),
        hookContentProvider
    );

    const treeView = vscode.window.createTreeView('kiroHooksView', {
        treeDataProvider: treeProvider,
        showCollapseAll: true
    });
    context.subscriptions.push(treeView);

    // Refresh tree when token changes
    context.subscriptions.push(
        tokenManager.onTokenChange(() => treeProvider.refresh())
    );

    registerCommands(context, hookService, treeProvider, tokenManager, recommendationService, workspaceAnalysisCache);

    context.subscriptions.push({
        dispose: () => tokenManager.dispose()
    });

    // Listen for repository/branch config changes and rewire the client
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('kiroHooks.repository') ||
                e.affectsConfiguration('kiroHooks.branch')) {
                const newConfig = vscode.workspace.getConfiguration('kiroHooks');
                const newRepo = newConfig.get<string>('repository', 'mikeartee/kiro-hooks-docs');
                const newBranch = newConfig.get<string>('branch', 'main');
                const newClient = new GitHubClient(newRepo, newBranch, () => tokenManager.getToken());
                hookService.setClient(newClient);
                // Await clearCache before refreshing so the tree fetches fresh
                // data from the new repository rather than serving stale cache.
                void hookService.clearCache().then(() => {
                    workspaceAnalysisCache.invalidate();
                    treeProvider.refresh();
                    void vscode.window.showInformationMessage('Settings updated — refreshing hooks...');
                }).catch((err: unknown) => {
                    console.error('Failed to clear cache after config change:', err);
                    treeProvider.refresh();
                });
            }
        })
    );

    // Auto-check for updates on activation
    const autoCheckUpdates = config.get<boolean>('autoCheckUpdates', true);
    if (autoCheckUpdates) {
        void performUpdateCheck(hookService, treeProvider).catch((error: unknown) => {
            console.error('Failed to check for hook updates on activation:', error);
        });
    }
}

export function deactivate(): void {
    // Clean up handled via context.subscriptions
}
