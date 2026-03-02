// External libraries
import * as vscode from 'vscode';

// Internal modules
import { GitHubClient } from './services/GitHubClient';
import { CacheManager } from './services/CacheManager';
import { HookService } from './services/HookService';
import { TokenManager } from './services/TokenManager';
import { HooksTreeProvider } from './providers/HooksTreeProvider';
import { registerCommands } from './commands';

export function activate(context: vscode.ExtensionContext): void {
    console.log('Kiro Hooks Browser is now active');

    const config = vscode.workspace.getConfiguration('kiroHooks');
    const repository = config.get<string>('repository', 'mikeartee/kiro-hooks-docs');
    const branch = config.get<string>('branch', 'main');

    const tokenManager = new TokenManager(context.secrets, context.subscriptions, context.secrets.onDidChange);
    const githubClient = new GitHubClient(repository, branch, () => tokenManager.getToken());
    const cacheManager = new CacheManager(context.globalState);
    const hookService = new HookService(githubClient, cacheManager);
    const treeProvider = new HooksTreeProvider(hookService);

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

    // Auto-check for updates on activation
    const autoCheckUpdates = config.get<boolean>('autoCheckUpdates', true);
    if (autoCheckUpdates) {
        hookService.checkForUpdates().then(async (updates) => {
            if (updates.length === 0) {
                return;
            }

            const names = updates.map(u => u.hook.name).join(', ');
            const message = updates.length === 1
                ? `Hook update available: ${names}`
                : `${updates.length} hook updates available: ${names}`;

            const action = await vscode.window.showInformationMessage(message, 'View Updates');

            if (action === 'View Updates') {
                const items = updates.map(u => ({
                    label: u.hook.name,
                    description: `${u.currentVersion} → ${u.newVersion}`,
                    update: u
                }));

                const selected = await vscode.window.showQuickPick(items, {
                    placeHolder: 'Select hooks to update',
                    canPickMany: true
                });

                if (selected && selected.length > 0) {
                    for (const item of selected) {
                        try {
                            await hookService.updateHook(item.update.hook);
                        } catch (error) {
                            vscode.window.showErrorMessage(
                                `Failed to update ${item.label}: ${error instanceof Error ? error.message : 'Unknown error'}`
                            );
                        }
                    }
                    treeProvider.refresh();
                }
            }
        }).catch((error: unknown) => {
            console.error('Failed to check for hook updates on activation:', error);
        });
    }
}

export function deactivate(): void {
    // Clean up handled via context.subscriptions
}
