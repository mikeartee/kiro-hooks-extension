// External libraries
import * as vscode from 'vscode';

// Internal modules
import { HookService } from '../services/HookService';

export const HOOK_SCHEME = 'kiro-hook';

export class HookContentProvider implements vscode.TextDocumentContentProvider {
    private readonly _onDidChange = new vscode.EventEmitter<vscode.Uri>();
    readonly onDidChange = this._onDidChange.event;

    constructor(private readonly hookService: HookService) {}

    async provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
        // uri.path is e.g. /code-quality/lint-on-save.json
        const hookPath = uri.path.startsWith('/') ? uri.path.slice(1) : uri.path;
        return this.hookService.fetchHookContent(hookPath);
    }
}
