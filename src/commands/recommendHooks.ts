// External libraries
import * as vscode from 'vscode';

// Internal modules
import { RecommendationService } from '../services/RecommendationService';
import { HookService } from '../services/HookService';
import { HooksTreeProvider } from '../providers/HooksTreeProvider';
import { ScoredHook } from '../models/types';

interface RecommendationQuickPickItem extends vscode.QuickPickItem {
    scoredHook: ScoredHook;
}

/**
 * Handle the recommend hooks command.
 * Analyses the workspace, shows a multi-select QuickPick of scored hooks,
 * and bulk-installs the selected ones.
 */
export async function recommendHooks(
    recommendationService: RecommendationService,
    hookService: HookService,
    treeProvider: HooksTreeProvider
): Promise<void> {
    let recommendations: ScoredHook[];

    try {
        recommendations = await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: 'Analysing workspace...',
                cancellable: false
            },
            async () => recommendationService.getRecommendations()
        );
    } catch (error) {
        vscode.window.showErrorMessage(
            `Failed to generate recommendations: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
        return;
    }

    if (recommendations.length === 0) {
        vscode.window.showInformationMessage(
            'No recommendations found for your workspace. Try installing some popular hooks from the Hooks Browser.'
        );
        return;
    }

    const items: RecommendationQuickPickItem[] = recommendations.map(scored => ({
        label: scored.hook.name,
        description: scored.reasons.length > 0
            ? scored.reasons[0].description
            : 'Recommended for your project',
        detail: scored.hook.description || scored.hook.category,
        scoredHook: scored,
        picked: false
    }));

    const quickPick = vscode.window.createQuickPick<RecommendationQuickPickItem>();
    quickPick.canSelectMany = true;
    quickPick.title = '✨ Recommended Hooks';
    quickPick.placeholder = 'Select hooks to install, then press Enter';
    quickPick.items = items;

    const selected = await new Promise<RecommendationQuickPickItem[] | undefined>(resolve => {
        let resolved = false;

        quickPick.onDidAccept(() => {
            if (resolved) { return; }
            resolved = true;
            const picks = [...quickPick.selectedItems];
            quickPick.hide();
            quickPick.dispose();
            resolve(picks.length > 0 ? picks : undefined);
        });

        quickPick.onDidHide(() => {
            if (resolved) { return; }
            resolved = true;
            quickPick.dispose();
            resolve(undefined);
        });

        quickPick.show();
    });

    if (!selected || selected.length === 0) {
        return;
    }

    await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: `Installing ${selected.length} hook${selected.length === 1 ? '' : 's'}...`,
            cancellable: false
        },
        async () => {
            for (const item of selected) {
                try {
                    await hookService.installHook(item.scoredHook.hook);
                } catch (error) {
                    vscode.window.showErrorMessage(
                        `Failed to install ${item.label}: ${error instanceof Error ? error.message : 'Unknown error'}`
                    );
                }
            }
        }
    );

    treeProvider.refresh();
    vscode.window.showInformationMessage(
        `Installed ${selected.length} hook${selected.length === 1 ? '' : 's'}`
    );
}
