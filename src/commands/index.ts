// External libraries
import * as vscode from 'vscode';

// Internal modules
import { HookService } from '../services/HookService';
import { HooksTreeProvider } from '../providers/HooksTreeProvider';
import { TokenManager } from '../services/TokenManager';
import { HookMetadata, InstalledHook, ExtensionError } from '../models/types';

/**
 * Register all command handlers for the Kiro Hooks extension
 */
export function registerCommands(
    context: vscode.ExtensionContext,
    hookService: HookService,
    treeProvider: HooksTreeProvider,
    tokenManager: TokenManager
): void {
    context.subscriptions.push(
        vscode.commands.registerCommand('kiroHooks.refresh', async () => {
            await handleRefresh(hookService, treeProvider);
        }),

        vscode.commands.registerCommand('kiroHooks.preview', async (item: unknown) => {
            await handlePreview(hookService, item);
        }),

        vscode.commands.registerCommand('kiroHooks.install', async (item: unknown) => {
            await handleInstall(hookService, treeProvider, item);
        }),

        vscode.commands.registerCommand('kiroHooks.uninstall', async (item: unknown) => {
            await handleUninstall(hookService, treeProvider, item);
        }),

        vscode.commands.registerCommand('kiroHooks.update', async (item: unknown) => {
            await handleUpdate(hookService, treeProvider, item);
        }),

        vscode.commands.registerCommand('kiroHooks.checkUpdates', async () => {
            await handleCheckUpdates(hookService, treeProvider);
        }),

        vscode.commands.registerCommand('kiroHooks.setToken', async () => {
            await handleSetToken(tokenManager, treeProvider);
        }),

        vscode.commands.registerCommand('kiroHooks.clearToken', async () => {
            await handleClearToken(tokenManager, treeProvider);
        }),

        vscode.commands.registerCommand('kiroHooks.checkTokenStatus', async () => {
            await handleCheckTokenStatus(tokenManager);
        }),

        vscode.commands.registerCommand('kiroHooks.toggle', async (item: unknown) => {
            await handleToggle(hookService, treeProvider, item);
        })
    );
}

async function handleRefresh(
    hookService: HookService,
    treeProvider: HooksTreeProvider
): Promise<void> {
    await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: 'Refreshing hooks...', cancellable: false },
        async () => {
            try {
                await hookService.clearCache();
                await hookService.fetchHookList();
                treeProvider.refresh();
                vscode.window.showInformationMessage('Hooks refreshed successfully');
            } catch (error) {
                vscode.window.showErrorMessage(
                    `Failed to refresh hooks: ${error instanceof Error ? error.message : 'Unknown error'}`
                );
            }
        }
    );
}

async function handlePreview(
    hookService: HookService,
    item: unknown
): Promise<void> {
    try {
        const hook = extractHookMetadata(item);
        if (!hook) {
            vscode.window.showErrorMessage('No hook selected');
            return;
        }

        const content = await vscode.window.withProgress(
            { location: vscode.ProgressLocation.Notification, title: `Loading ${hook.name}...`, cancellable: false },
            async () => hookService.fetchHookContent(hook.path)
        );

        const uri = vscode.Uri.parse(`untitled:${hook.name}`);
        const doc = await vscode.workspace.openTextDocument(uri);
        const edit = new vscode.WorkspaceEdit();
        edit.insert(uri, new vscode.Position(0, 0), content);
        await vscode.workspace.applyEdit(edit);
        await vscode.window.showTextDocument(doc, { preview: true, viewColumn: vscode.ViewColumn.Beside });
    } catch (error) {
        vscode.window.showErrorMessage(
            `Failed to preview hook: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
    }
}

async function handleInstall(
    hookService: HookService,
    treeProvider: HooksTreeProvider,
    item: unknown
): Promise<void> {
    try {
        const hook = extractHookMetadata(item);
        if (!hook) {
            vscode.window.showErrorMessage('No hook selected');
            return;
        }

        await vscode.window.withProgress(
            { location: vscode.ProgressLocation.Notification, title: `Installing ${hook.name}...`, cancellable: false },
            async () => hookService.installHook(hook)
        );

        treeProvider.refresh();
    } catch (error) {
        if (error instanceof ExtensionError) {
            vscode.window.showErrorMessage(error.message);
        } else {
            vscode.window.showErrorMessage(
                `Failed to install hook: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
        }
    }
}

async function handleUninstall(
    hookService: HookService,
    treeProvider: HooksTreeProvider,
    item: unknown
): Promise<void> {
    try {
        const node = item as { type?: string; installed?: { path: string }; metadata?: HookMetadata };
        const hookPath = node?.installed?.path;

        if (!hookPath) {
            vscode.window.showErrorMessage(
                'Cannot uninstall: hook has no installation record. It may not be installed.'
            );
            return;
        }

        await vscode.window.withProgress(
            { location: vscode.ProgressLocation.Notification, title: 'Uninstalling hook...', cancellable: false },
            async () => hookService.uninstallHook(hookPath)
        );

        treeProvider.refresh();
    } catch (error) {
        if (error instanceof ExtensionError) {
            vscode.window.showErrorMessage(error.message);
        } else {
            vscode.window.showErrorMessage(
                `Failed to uninstall hook: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
        }
    }
}

async function handleUpdate(
    hookService: HookService,
    treeProvider: HooksTreeProvider,
    item: unknown
): Promise<void> {
    try {
        const hook = extractHookMetadata(item);
        if (!hook) {
            vscode.window.showErrorMessage('No hook selected');
            return;
        }

        await vscode.window.withProgress(
            { location: vscode.ProgressLocation.Notification, title: `Updating ${hook.name}...`, cancellable: false },
            async () => hookService.updateHook(hook)
        );

        treeProvider.refresh();
    } catch (error) {
        if (error instanceof ExtensionError) {
            vscode.window.showErrorMessage(error.message);
        } else {
            vscode.window.showErrorMessage(
                `Failed to update hook: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
        }
    }
}

async function handleCheckUpdates(
    hookService: HookService,
    treeProvider: HooksTreeProvider
): Promise<void> {
    const updates = await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: 'Checking for updates...', cancellable: false },
        async () => {
            try {
                return await hookService.checkForUpdates();
            } catch (error) {
                vscode.window.showErrorMessage(
                    `Failed to check for updates: ${error instanceof Error ? error.message : 'Unknown error'}`
                );
                return [];
            }
        }
    );

    treeProvider.refresh();

    if (updates.length === 0) {
        vscode.window.showInformationMessage('All hooks are up to date');
        return;
    }

    const names = updates.map(u => u.hook.name).join(', ');
    const message = updates.length === 1
        ? `Update available: ${names}`
        : `${updates.length} updates available: ${names}`;

    const action = await vscode.window.showInformationMessage(message, 'Update All');

    if (action === 'Update All') {
        for (const update of updates) {
            try {
                await hookService.updateHook(update.hook);
            } catch (error) {
                vscode.window.showErrorMessage(
                    `Failed to update ${update.hook.name}: ${error instanceof Error ? error.message : 'Unknown error'}`
                );
            }
        }
        treeProvider.refresh();
        vscode.window.showInformationMessage('All hooks updated successfully');
    }
}

async function handleSetToken(
    tokenManager: TokenManager,
    treeProvider: HooksTreeProvider
): Promise<void> {
    const token = await vscode.window.showInputBox({
        prompt: 'Enter your GitHub Personal Access Token',
        password: true,
        placeHolder: 'ghp_... or github_pat_...',
        validateInput: (value) => {
            if (!value || value.trim().length === 0) {
                return 'Token cannot be empty';
            }
            return null;
        }
    });

    if (!token) {
        return;
    }

    await tokenManager.setToken(token.trim());
    vscode.window.showInformationMessage('GitHub token saved securely');
    treeProvider.refresh();
}

async function handleClearToken(
    tokenManager: TokenManager,
    treeProvider: HooksTreeProvider
): Promise<void> {
    const confirm = await vscode.window.showWarningMessage(
        'Clear the stored GitHub token?',
        'Clear',
        'Cancel'
    );

    if (confirm === 'Clear') {
        await tokenManager.clearToken();
        vscode.window.showInformationMessage('GitHub token cleared');
        treeProvider.refresh();
    }
}

async function handleCheckTokenStatus(tokenManager: TokenManager): Promise<void> {
    const info = await tokenManager.getTokenInfo();

    if (!info.hasToken) {
        vscode.window.showInformationMessage(
            'No GitHub token configured. Use "Kiro Hooks: Set GitHub Token" to add one.'
        );
        return;
    }

    vscode.window.showInformationMessage(
        `GitHub token configured (type: ${info.tokenType ?? 'unknown'})`
    );
}

/**
 * Handle toggle command — install if not installed, uninstall if installed
 */
async function handleToggle(
    hookService: HookService,
    treeProvider: HooksTreeProvider,
    item: unknown
): Promise<void> {
    try {
        const node = item as { type?: string; metadata?: HookMetadata; installed?: InstalledHook };
        const hook = node?.metadata;

        if (!hook) {
            vscode.window.showErrorMessage('No hook selected');
            return;
        }

        const isInstalled = !!node.installed;

        if (isInstalled && node.installed) {
            await vscode.window.withProgress(
                { location: vscode.ProgressLocation.Notification, title: `Uninstalling ${hook.name}...`, cancellable: false },
                async () => hookService.uninstallHook(node.installed!.path)
            );
        } else {
            await vscode.window.withProgress(
                { location: vscode.ProgressLocation.Notification, title: `Installing ${hook.name}...`, cancellable: false },
                async () => hookService.installHook(hook)
            );
        }

        treeProvider.refresh();
    } catch (error) {
        if (error instanceof ExtensionError) {
            vscode.window.showErrorMessage(error.message);
        } else {
            vscode.window.showErrorMessage(
                `Failed to toggle hook: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
        }
        treeProvider.refresh();
    }
}

/**
 * Extract HookMetadata from a tree node item passed to commands
 */
function extractHookMetadata(item: unknown): HookMetadata | undefined {
    const node = item as { metadata?: HookMetadata };
    return node?.metadata;
}
