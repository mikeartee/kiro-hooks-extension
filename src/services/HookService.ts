// External libraries
import * as vscode from 'vscode';

// Internal modules
import { GitHubClient } from './GitHubClient';
import { CacheManager } from './CacheManager';
import {
    HookMetadata,
    InstalledHook,
    HookUpdateInfo,
    CategoryDefinition,
    KiroHookSchema,
    HookEventType,
    HookActionType,
    ErrorCode,
    ExtensionError
} from '../models/types';

/**
 * Service for managing Kiro hooks — fetching from GitHub and installing to .kiro/hooks/
 */
export class HookService {
    private readonly CACHE_KEY_HOOKS = 'hookList';
    private readonly hooksDir = '.kiro/hooks';

    constructor(
        private readonly githubClient: GitHubClient,
        private readonly cacheManager: CacheManager
    ) {}

    /**
     * Clear the hook list cache
     */
    async clearCache(): Promise<void> {
        await this.cacheManager.clear(this.CACHE_KEY_HOOKS);
    }

    /**
     * Fetch the list of available hooks from GitHub with caching
     */
    async fetchHookList(): Promise<HookMetadata[]> {
        const cached = this.cacheManager.get<HookMetadata[]>(this.CACHE_KEY_HOOKS);
        if (cached && cached.length > 0) {
            return cached;
        }

        try {
            const categoriesContent = await this.githubClient.getRawFileContent('categories.json');
            const categoriesData = JSON.parse(categoriesContent) as { categories: CategoryDefinition[] };
            const categories: CategoryDefinition[] = categoriesData.categories ?? [];

            const hooks: HookMetadata[] = [];

            for (const category of categories) {
                try {
                    const categoryHooks = await this.fetchHooksFromDirectory(category.id, category.id);
                    hooks.push(...categoryHooks);
                } catch (error) {
                    console.error(`Failed to fetch hooks from category ${category.id}:`, error);
                }
            }

            await this.cacheManager.set(this.CACHE_KEY_HOOKS, hooks, 3600);
            return hooks;
        } catch (error) {
            const cached = this.cacheManager.get<HookMetadata[]>(this.CACHE_KEY_HOOKS);
            if (cached) {
                return cached;
            }
            if (error instanceof ExtensionError && error.code === ErrorCode.NOT_FOUND) {
                void vscode.window.showWarningMessage(
                    'Hook repository not yet available (categories.json not found).'
                );
                return [];
            }
            throw error;
        }
    }

    /**
     * Recursively fetch hook JSON files from a GitHub directory
     */
    private async fetchHooksFromDirectory(dirPath: string, categoryId: string): Promise<HookMetadata[]> {
        const hooks: HookMetadata[] = [];

        try {
            const contents = await this.githubClient.getRepositoryContents(dirPath);

            for (const item of contents) {
                if (item.name.toLowerCase() === 'readme.md') {
                    continue;
                }

                if (item.type === 'file' && item.name.endsWith('.json')) {
                    try {
                        const content = await this.githubClient.getRawFileContent(item.path);
                        const schema = JSON.parse(content) as KiroHookSchema;

                        hooks.push({
                            name: schema.name ?? item.name.replace(/\.json$/, ''),
                            path: item.path,
                            category: categoryId,
                            version: schema.version ?? '1.0.0',
                            description: schema.description ?? '',
                            sha: item.sha,
                            size: item.size,
                            downloadUrl: item.download_url,
                            eventType: schema.when.type as HookEventType,
                            actionType: schema.then.type as HookActionType,
                            tags: []
                        });
                    } catch (error) {
                        console.error(`Failed to parse hook ${item.path}:`, error);
                    }
                } else if (item.type === 'dir') {
                    const subHooks = await this.fetchHooksFromDirectory(item.path, categoryId);
                    hooks.push(...subHooks);
                }
            }
        } catch (error) {
            console.error(`Failed to fetch hooks from ${dirPath}:`, error);
        }

        return hooks;
    }

    /**
     * Fetch the raw JSON content of a specific hook
     */
    async fetchHookContent(path: string): Promise<string> {
        try {
            return await this.githubClient.getRawFileContent(path);
        } catch (error) {
            if (error instanceof ExtensionError) {
                throw error;
            }
            throw new ExtensionError(
                `Failed to fetch hook content: ${error instanceof Error ? error.message : 'Unknown error'}`,
                ErrorCode.NETWORK_ERROR,
                true
            );
        }
    }

    /**
     * Get list of installed hooks from the local .kiro/hooks/ directory
     */
    async getInstalledHooks(): Promise<InstalledHook[]> {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            return [];
        }

        const hooksDirUri = vscode.Uri.joinPath(workspaceFolder.uri, this.hooksDir);

        try {
            return await this.scanHooksDirectory(hooksDirUri, hooksDirUri);
        } catch (error) {
            if (error instanceof vscode.FileSystemError) {
                return [];
            }
            throw new ExtensionError(
                `Failed to read installed hooks: ${error instanceof Error ? error.message : 'Unknown error'}`,
                ErrorCode.FILE_SYSTEM_ERROR,
                false
            );
        }
    }

    private async scanHooksDirectory(
        dirUri: vscode.Uri,
        baseUri: vscode.Uri
    ): Promise<InstalledHook[]> {
        const installed: InstalledHook[] = [];

        try {
            const entries = await vscode.workspace.fs.readDirectory(dirUri);

            for (const [name, type] of entries) {
                const itemUri = vscode.Uri.joinPath(dirUri, name);

                if (type === vscode.FileType.File && (name.endsWith('.json') || name.endsWith('.kiro.hook'))) {
                    try {
                        const content = await vscode.workspace.fs.readFile(itemUri);
                        const schema = JSON.parse(Buffer.from(content).toString('utf-8')) as KiroHookSchema & { _sha?: string };
                        const stats = await vscode.workspace.fs.stat(itemUri);

                        const relativePath = itemUri.fsPath
                            .substring(baseUri.fsPath.length + 1)
                            .replace(/\\/g, '/');

                        installed.push({
                            name,
                            path: relativePath,
                            version: schema.version ?? '1.0.0',
                            installedAt: new Date(stats.mtime),
                            sha: schema._sha ?? ''
                        });
                    } catch (error) {
                        console.error(`Failed to read hook ${name}:`, error);
                    }
                } else if (type === vscode.FileType.Directory) {
                    const subHooks = await this.scanHooksDirectory(itemUri, baseUri);
                    installed.push(...subHooks);
                }
            }
        } catch (error) {
            if (error instanceof vscode.FileSystemError && error.code === 'FileNotFound') {
                // Directory doesn't exist yet — not an error, just no hooks installed
                return [];
            }
            console.error(`Failed to scan hooks directory ${dirUri.fsPath}:`, error);
        }

        return installed;
    }

    /**
     * Install a hook to the local .kiro/hooks/ directory
     */
    async installHook(hook: HookMetadata): Promise<void> {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            throw new ExtensionError(
                'No workspace folder open',
                ErrorCode.FILE_SYSTEM_ERROR,
                false
            );
        }

        const hooksDirUri = vscode.Uri.joinPath(workspaceFolder.uri, this.hooksDir);

        // Install flat into .kiro/hooks/ using .kiro.hook extension (Kiro's required format)
        const baseName = hook.path.split('/').pop()?.replace(/\.json$/, '') ?? hook.name;
        const fileName = `${baseName}.kiro.hook`;
        const fileUri = vscode.Uri.joinPath(hooksDirUri, fileName);

        try {
            // Check if already exists
            try {
                await vscode.workspace.fs.stat(fileUri);
                const answer = await vscode.window.showWarningMessage(
                    `Hook "${hook.name}" already exists. Overwrite?`,
                    'Overwrite',
                    'Cancel'
                );
                if (answer !== 'Overwrite') {
                    return;
                }
            } catch {
                // File doesn't exist — proceed
            }

            // Ensure .kiro/hooks/ directory exists
            await vscode.workspace.fs.createDirectory(hooksDirUri);

            // Fetch and embed SHA for update tracking
            const rawContent = await this.fetchHookContent(hook.path);
            const schema = JSON.parse(rawContent) as KiroHookSchema;
            const withSha = { ...schema, _sha: hook.sha };
            const finalContent = JSON.stringify(withSha, null, 2);

            await vscode.workspace.fs.writeFile(fileUri, Buffer.from(finalContent, 'utf-8'));
            vscode.window.showInformationMessage(`Hook "${hook.name}" installed successfully`);
        } catch (error) {
            if (error instanceof ExtensionError) {
                throw error;
            }
            throw new ExtensionError(
                `Failed to install hook: ${error instanceof Error ? error.message : 'Unknown error'}`,
                ErrorCode.FILE_SYSTEM_ERROR,
                false
            );
        }
    }

    /**
     * Uninstall a hook by removing it from .kiro/hooks/
     */
    async uninstallHook(hookPath: string): Promise<void> {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            throw new ExtensionError(
                'No workspace folder open',
                ErrorCode.FILE_SYSTEM_ERROR,
                false
            );
        }

        const hooksDirUri = vscode.Uri.joinPath(workspaceFolder.uri, this.hooksDir);
        const fileUri = vscode.Uri.joinPath(hooksDirUri, hookPath);

        try {
            await vscode.workspace.fs.stat(fileUri);
            await vscode.workspace.fs.delete(fileUri);
            const fileName = hookPath.split('/').pop() ?? hookPath;
            vscode.window.showInformationMessage(`Hook "${fileName}" uninstalled successfully`);
        } catch (error) {
            if (error instanceof vscode.FileSystemError) {
                throw new ExtensionError(
                    `Hook "${hookPath}" not found`,
                    ErrorCode.NOT_FOUND,
                    false
                );
            }
            throw new ExtensionError(
                `Failed to uninstall hook: ${error instanceof Error ? error.message : 'Unknown error'}`,
                ErrorCode.FILE_SYSTEM_ERROR,
                false
            );
        }
    }

    /**
     * Update an installed hook to the latest version
     */
    async updateHook(hook: HookMetadata): Promise<void> {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            throw new ExtensionError(
                'No workspace folder open',
                ErrorCode.FILE_SYSTEM_ERROR,
                false
            );
        }

        const hooksDirUri = vscode.Uri.joinPath(workspaceFolder.uri, this.hooksDir);

        // Match the flat .kiro.hook install path
        const baseName = hook.path.split('/').pop()?.replace(/\.json$/, '') ?? hook.name;
        const fileName = `${baseName}.kiro.hook`;
        const fileUri = vscode.Uri.joinPath(hooksDirUri, fileName);

        try {
            const rawContent = await this.fetchHookContent(hook.path);
            const schema = JSON.parse(rawContent) as KiroHookSchema;
            const withSha = { ...schema, _sha: hook.sha };
            const finalContent = JSON.stringify(withSha, null, 2);

            await vscode.workspace.fs.createDirectory(hooksDirUri);
            await vscode.workspace.fs.writeFile(fileUri, Buffer.from(finalContent, 'utf-8'));
            vscode.window.showInformationMessage(
                `Hook "${hook.name}" updated to version ${hook.version}`
            );
        } catch (error) {
            if (error instanceof ExtensionError) {
                throw error;
            }
            throw new ExtensionError(
                `Failed to update hook: ${error instanceof Error ? error.message : 'Unknown error'}`,
                ErrorCode.FILE_SYSTEM_ERROR,
                false
            );
        }
    }

    /**
     * Check for updates to installed hooks
     */
    async checkForUpdates(): Promise<HookUpdateInfo[]> {
        const installedHooks = await this.getInstalledHooks();
        if (installedHooks.length === 0) {
            return [];
        }

        const remoteHooks = await this.fetchHookList();
        const updates: HookUpdateInfo[] = [];

        for (const installed of installedHooks) {
            if (!installed.sha) {
                continue;
            }
            const remote = remoteHooks.find(h => h.path === installed.path);
            if (remote && remote.sha !== installed.sha) {
                updates.push({
                    hook: remote,
                    currentVersion: installed.version,
                    newVersion: remote.version
                });
            }
        }

        return updates;
    }
}
