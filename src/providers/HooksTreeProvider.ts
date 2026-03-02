// External libraries
import * as vscode from 'vscode';

// Internal modules
import { HookService } from '../services/HookService';
import { HookMetadata, InstalledHook } from '../models/types';

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

    constructor(private readonly hookService: HookService) {}

    refresh(): void {
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

            const categoryMap = new Map<string, { label: string; description: string }>();
            for (const hook of this.remoteHooks) {
                if (!categoryMap.has(hook.category)) {
                    categoryMap.set(hook.category, {
                        label: this.formatCategoryLabel(hook.category),
                        description: ''
                    });
                }
            }

            const categories: TreeNode[] = [];
            for (const [id, info] of categoryMap) {
                const hooksInCategory = this.remoteHooks.filter(h => h.category === id);
                if (hooksInCategory.length > 0) {
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

    private async fetchData(): Promise<void> {
        const [remote, installed] = await Promise.all([
            this.hookService.fetchHookList(),
            this.hookService.getInstalledHooks()
        ]);
        this.remoteHooks = remote;
        this.installedHooks = installed;
    }

    private getHooksForCategory(categoryId: string): TreeNode[] {
        const categoryHooks = this.remoteHooks.filter(h => h.category === categoryId);
        const nodes: TreeNode[] = [];

        for (const hook of categoryHooks) {
            // Remote path is e.g. "documentation/changelog-reminder.json"
            // Installed path is e.g. "changelog-reminder.kiro.hook"
            // Match by stripping directory and extension from both sides
            const remoteBaseName = hook.path.split('/').pop()?.replace(/\.json$/, '') ?? '';
            const installed = this.installedHooks.find(i => {
                const installedBaseName = i.path.split('/').pop()?.replace(/\.kiro\.hook$/, '').replace(/\.json$/, '') ?? '';
                return installedBaseName === remoteBaseName;
            });
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

    private formatCategoryLabel(categoryId: string): string {
        return categoryId
            .split('-')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
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
