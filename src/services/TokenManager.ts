// External libraries
import * as vscode from 'vscode';

// Internal modules
import { TokenInfo, TokenType } from '../models/types';

const SECRET_KEY = 'kiroHooks.githubToken';

/**
 * Manages secure storage and retrieval of GitHub tokens
 */
export class TokenManager implements vscode.Disposable {
    private readonly _onTokenChange = new vscode.EventEmitter<void>();
    readonly onTokenChange = this._onTokenChange.event;

    constructor(
        private readonly secrets: vscode.SecretStorage,
        subscriptions: vscode.Disposable[],
        private readonly _onSecretsChange?: vscode.Event<vscode.SecretStorageChangeEvent>
    ) {
        if (this._onSecretsChange) {
            const disposable = this._onSecretsChange((e) => {
                if (e.key === SECRET_KEY) {
                    this._onTokenChange.fire();
                }
            });
            subscriptions.push(disposable);
        }
    }

    /**
     * Get the stored GitHub token, or undefined if not set
     */
    async getToken(): Promise<string | undefined> {
        return this.secrets.get(SECRET_KEY);
    }

    /**
     * Store a GitHub token securely
     */
    async setToken(token: string): Promise<void> {
        await this.secrets.store(SECRET_KEY, token);
        this._onTokenChange.fire();
    }

    /**
     * Remove the stored GitHub token
     */
    async clearToken(): Promise<void> {
        await this.secrets.delete(SECRET_KEY);
        this._onTokenChange.fire();
    }

    /**
     * Get basic info about the current token state
     */
    async getTokenInfo(): Promise<TokenInfo> {
        const token = await this.getToken();

        if (!token) {
            return { hasToken: false, source: 'none' };
        }

        const tokenType = this.detectTokenType(token);
        return { hasToken: true, tokenType, source: 'secretStorage' };
    }

    private detectTokenType(token: string): TokenType {
        if (token.startsWith('github_pat_')) {
            return TokenType.FINE_GRAINED;
        }
        if (token.startsWith('ghp_')) {
            return TokenType.CLASSIC;
        }
        if (token.startsWith('gho_')) {
            return TokenType.OAUTH;
        }
        if (token.startsWith('ghs_')) {
            return TokenType.GITHUB_ACTIONS;
        }
        return TokenType.UNKNOWN;
    }

    dispose(): void {
        this._onTokenChange.dispose();
    }
}
