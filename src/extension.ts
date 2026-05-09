// External libraries
import * as vscode from 'vscode';

// Internal modules
import { GitHubClient } from './services/GitHubClient';
import { CacheManager } from './services/CacheManager';
import { HookService } from './services/HookService';
import { TokenManager } from './services/TokenManager';
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

    const hookContentProvider = new HookContentProvider(hookService);
    context.subscriptions.push(
        vscode.workspace.registerTextDocumentContentProvider(HOOK_SCHEME, hookContentProvider)
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

    registerCommands(context, hookService, treeProvider, tokenManager);

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
                void hookService.clearCache();
                treeProvider.refresh();
                void vscode.window.showInformationMessage('Settings updated — refreshing hooks...');
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
