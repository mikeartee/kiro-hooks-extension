// External libraries
import * as vscode from 'vscode';

// Internal modules
import { HookService } from '../services/HookService';

export const HOOK_SCHEME = 'kiro-hook';

export class HookContentProvider implements vscode.TextDocumentContentProvider, vscode.Disposable {
    private readonly _onDidChange = new vscode.EventEmitter<vscode.Uri>();
    readonly onDidChange = this._onDidChange.event;

    constructor(private readonly hookService: HookService) {}

    dispose(): void {
        this._onDidChange.dispose();
    }

    async provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
        // uri.path is e.g. /code-quality/lint-on-save.json
        const hookPath = uri.path.startsWith('/') ? uri.path.slice(1) : uri.path;
        try {
            return await this.hookService.fetchHookContent(hookPath);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            // Return a JSON comment so the document opens with readable feedback
            // rather than VS Code showing a generic "Unable to open" dialog.
            return JSON.stringify({ error: `Failed to load hook: ${message}` }, null, 2);
        }
    }
}
