// External libraries
import * as vscode from 'vscode';

// Internal modules
import { HookService } from '../services/HookService';
import { HookMetadata, InstalledHook, CategoryDefinition } from '../models/types';

/**
 * Union type for all tree node types
 */
type TreeNode = CategoryNode | HookNode;

/**
 * Category node in the tree
 */
interface CategoryNode {
    type: 'category';
    id: string;
    label: string;
    description: string;
}

/**
 * Hook node in the tree
 */
interface HookNode {
    type: 'hook';
    metadata: HookMetadata;
    installed?: InstalledHook;
    hasUpdate: boolean;
}

/**
 * Tree data provider for the Kiro Hooks browser
 */
export class HooksTreeProvider implements vscode.TreeDataProvider<TreeNode> {
    private readonly _onDidChangeTreeData = new vscode.EventEmitter<TreeNode | undefined | null | void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    private remoteHooks: HookMetadata[] = [];
    private installedHooks: InstalledHook[] = [];
    private categories: CategoryDefinition[] = [];
    private fetchPromise: Promise<void> | null = null;

    constructor(private readonly hookService: HookService) {}

    refresh(): void {
        this.fetchPromise = null; // clear so next expand re-fetches
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: TreeNode): vscode.TreeItem {
        if (element.type === 'category') {
            return this.createCategoryTreeItem(element);
        }
        return this.createHookTreeItem(element);
    }

    async getChildren(element?: TreeNode): Promise<TreeNode[]> {
        if (!element) {
            return this.getRootItems();
        }

        if (element.type === 'category') {
            return this.getHooksForCategory(element.id);
        }

        return [];
    }

    private async getRootItems(): Promise<TreeNode[]> {
        try {
            await this.fetchData();

            const categories: TreeNode[] = [];
            for (const cat of this.categories) {
                const hooksInCategory = this.remoteHooks.filter(h => h.category === cat.id);
                if (hooksInCategory.length > 0) {
                    categories.push({
                        type: 'category',
                        id: cat.id,
                        label: cat.label,
                        description: cat.description
                    });
                }
            }

            // Fallback: if categories is empty (e.g. cache hit before categories loaded),
            // derive from hooks as before
            if (categories.length === 0 && this.remoteHooks.length > 0) {
                const categoryMap = new Map<string, { label: string; description: string }>();
                for (const hook of this.remoteHooks) {
                    if (!categoryMap.has(hook.category)) {
                        categoryMap.set(hook.category, {
                            label: hook.category.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
                            description: ''
                        });
                    }
                }
                for (const [id, info] of categoryMap) {
                    categories.push({ type: 'category', id, ...info });
                }
            }

            return categories;
        } catch (error) {
            const msg = error instanceof Error ? error.message : 'Unknown error';
            void vscode.window.showErrorMessage(`Failed to load hooks: ${msg}`);
            return [];
        }
    }

    private fetchData(): Promise<void> {
        if (!this.fetchPromise) {
            this.fetchPromise = this._doFetch().finally(() => {
                this.fetchPromise = null;
            });
        }
        return this.fetchPromise;
    }

    private async _doFetch(): Promise<void> {
        const [remote, installed, categories] = await Promise.all([
            this.hookService.fetchHookList(),
            this.hookService.getInstalledHooks(),
            Promise.resolve(this.hookService.getCategories())
        ]);
        this.remoteHooks = remote;
        this.installedHooks = installed;
        this.categories = categories;
    }

    private getHooksForCategory(categoryId: string): TreeNode[] {
        const categoryHooks = this.remoteHooks.filter(h => h.category === categoryId);
        const nodes: TreeNode[] = [];

        for (const hook of categoryHooks) {
            // hook.path is e.g. "code-quality/lint-on-save.json"
            // installed.path is e.g. "code-quality/lint-on-save.kiro.hook"
            const expectedInstalledPath = hook.path.replace(/\.json$/, '.kiro.hook');
            const installed = this.installedHooks.find(i => i.path === expectedInstalledPath);
            const hasUpdate = installed?.sha ? installed.sha !== hook.sha : false;

            nodes.push({ type: 'hook', metadata: hook, installed, hasUpdate });
        }

        return nodes.sort((a, b) => {
            if (a.type === 'hook' && b.type === 'hook') {
                return a.metadata.name.localeCompare(b.metadata.name);
            }
            return 0;
        });
    }

    private createCategoryTreeItem(node: CategoryNode): vscode.TreeItem {
        const item = new vscode.TreeItem(node.label, vscode.TreeItemCollapsibleState.Collapsed);
        item.tooltip = node.description || node.label;
        item.contextValue = 'category';
        item.iconPath = new vscode.ThemeIcon('folder');
        return item;
    }

    private createHookTreeItem(node: HookNode): vscode.TreeItem {
        const item = new vscode.TreeItem(node.metadata.name, vscode.TreeItemCollapsibleState.None);

        if (node.hasUpdate && node.installed) {
            item.description = `${node.installed.version} → ${node.metadata.version}`;
        } else {
            item.description = node.metadata.version;
        }

        item.tooltip = this.buildTooltip(node);
        item.contextValue = this.getContextValue(node);
        item.iconPath = this.getIcon(node);

        item.command = {
            command: 'kiroHooks.toggle',
            title: 'Toggle Hook',
            arguments: [node]
        };

        return item;
    }

    private buildTooltip(node: HookNode): string {
        const lines: string[] = [
            node.metadata.description || node.metadata.name,
            `Event: ${node.metadata.eventType}`,
            `Action: ${node.metadata.actionType}`,
            `Version: ${node.metadata.version}`
        ];

        if (node.installed) {
            lines.push(`Installed: ${node.installed.installedAt.toLocaleDateString()}`);
        }

        if (node.hasUpdate) {
            lines.push(`[UPDATE AVAILABLE] ${node.installed?.version ?? 'unknown'} → ${node.metadata.version}`);
        }

        if (node.metadata.tags && node.metadata.tags.length > 0) {
            lines.push(`Tags: ${node.metadata.tags.join(', ')}`);
        }

        return lines.join('\n');
    }

    private getContextValue(node: HookNode): string {
        if (!node.installed) {
            return 'hook-available';
        }
        if (node.hasUpdate) {
            return 'hook-update-available';
        }
        return 'hook-installed';
    }

    private getIcon(node: HookNode): vscode.ThemeIcon {
        if (!node.installed) {
            return new vscode.ThemeIcon('circle-outline');
        }
        if (node.hasUpdate) {
            return new vscode.ThemeIcon('circle-filled', new vscode.ThemeColor('charts.orange'));
        }
        return new vscode.ThemeIcon('circle-filled', new vscode.ThemeColor('charts.green'));
    }
}
