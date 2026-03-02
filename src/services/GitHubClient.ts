// External libraries
import * as https from 'https';

// Internal modules
import { GitHubContent, ErrorCode, ExtensionError } from '../models/types';

// Type imports
import type { IncomingMessage } from 'http';

/**
 * Function type that asynchronously retrieves the current GitHub token
 */
export type TokenProvider = () => Promise<string | undefined>;

/**
 * Client for interacting with the GitHub API
 */
export class GitHubClient {
    private readonly baseUrl = 'https://api.github.com';
    private readonly rawBaseUrl = 'https://raw.githubusercontent.com';
    private readonly timeout = 30000;
    private readonly maxRetries = 3;
    private readonly retryDelay = 1000;

    constructor(
        private readonly repository: string,
        private readonly branch: string = 'main',
        private readonly getToken: TokenProvider
    ) {}

    /**
     * Fetch directory contents from the repository
     */
    async getRepositoryContents(path: string): Promise<GitHubContent[]> {
        const url = `${this.baseUrl}/repos/${this.repository}/contents/${path}?ref=${this.branch}`;
        const response = await this.makeRequestWithRetry(url);

        if (!Array.isArray(response)) {
            throw new ExtensionError(
                'Expected array response from GitHub API',
                ErrorCode.PARSE_ERROR,
                false
            );
        }

        return response as GitHubContent[];
    }

    /**
     * Fetch raw file content directly
     */
    async getRawFileContent(path: string): Promise<string> {
        const url = `${this.rawBaseUrl}/${this.repository}/${this.branch}/${path}`;
        return this.makeRawRequestWithRetry(url);
    }

    private async makeRequestWithRetry(url: string): Promise<unknown> {
        let lastError: ExtensionError | null = null;

        for (let attempt = 0; attempt < this.maxRetries; attempt++) {
            try {
                return await this.makeRequest(url);
            } catch (error) {
                if (error instanceof ExtensionError) {
                    lastError = error;
                    if (!error.recoverable) {
                        throw error;
                    }
                    if (attempt < this.maxRetries - 1) {
                        await this.delay(this.retryDelay * (attempt + 1));
                    }
                } else {
                    throw error;
                }
            }
        }

        throw lastError ?? new ExtensionError(
            'Request failed after maximum retries',
            ErrorCode.NETWORK_ERROR,
            false
        );
    }

    private async makeRawRequestWithRetry(url: string): Promise<string> {
        let lastError: ExtensionError | null = null;

        for (let attempt = 0; attempt < this.maxRetries; attempt++) {
            try {
                return await this.makeRawRequest(url);
            } catch (error) {
                if (error instanceof ExtensionError) {
                    lastError = error;
                    if (!error.recoverable) {
                        throw error;
                    }
                    if (attempt < this.maxRetries - 1) {
                        await this.delay(this.retryDelay * (attempt + 1));
                    }
                } else {
                    throw error;
                }
            }
        }

        throw lastError ?? new ExtensionError(
            'Request failed after maximum retries',
            ErrorCode.NETWORK_ERROR,
            false
        );
    }

    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    private async makeRequest(url: string): Promise<unknown> {
        const token = await this.getToken();

        return new Promise((resolve, reject) => {
            const headers: Record<string, string> = {
                'User-Agent': 'VSCode-Kiro-Hooks-Browser',
                'Accept': 'application/vnd.github.v3+json'
            };

            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }

            const req = https.get(url, { headers, timeout: this.timeout }, (res) => {
                let data = '';
                res.on('data', (chunk) => { data += chunk; });
                res.on('end', () => {
                    if (res.statusCode === 200) {
                        try {
                            resolve(JSON.parse(data));
                        } catch {
                            reject(new ExtensionError(
                                'Failed to parse GitHub API response',
                                ErrorCode.PARSE_ERROR,
                                false
                            ));
                        }
                    } else {
                        reject(this.handleHttpError(res.statusCode ?? 0, data, res));
                    }
                });
            });

            req.on('timeout', () => {
                req.destroy();
                reject(new ExtensionError(
                    'Request to GitHub API timed out',
                    ErrorCode.NETWORK_ERROR,
                    true
                ));
            });

            req.on('error', (error) => {
                reject(new ExtensionError(
                    `Network error: ${error.message}`,
                    ErrorCode.NETWORK_ERROR,
                    true
                ));
            });
        });
    }

    private async makeRawRequest(url: string): Promise<string> {
        const token = await this.getToken();

        return new Promise((resolve, reject) => {
            const headers: Record<string, string> = {
                'User-Agent': 'VSCode-Kiro-Hooks-Browser'
            };

            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }

            const req = https.get(url, { headers, timeout: this.timeout }, (res) => {
                let data = '';
                res.on('data', (chunk) => { data += chunk; });
                res.on('end', () => {
                    if (res.statusCode === 200) {
                        resolve(data);
                    } else {
                        reject(this.handleHttpError(res.statusCode ?? 0, data, res));
                    }
                });
            });

            req.on('timeout', () => {
                req.destroy();
                reject(new ExtensionError(
                    'Request to GitHub timed out',
                    ErrorCode.NETWORK_ERROR,
                    true
                ));
            });

            req.on('error', (error) => {
                reject(new ExtensionError(
                    `Network error: ${error.message}`,
                    ErrorCode.NETWORK_ERROR,
                    true
                ));
            });
        });
    }

    private handleHttpError(statusCode: number, responseBody: string, response?: IncomingMessage): ExtensionError {
        switch (statusCode) {
            case 401:
                return new ExtensionError(
                    'GitHub token is invalid or has expired. Please set a new token via the Kiro Hooks: Set GitHub Token command.',
                    ErrorCode.NETWORK_ERROR,
                    false
                );
            case 403: {
                const rateLimitRemaining = response?.headers['x-ratelimit-remaining'];
                const rateLimitReset = response?.headers['x-ratelimit-reset'];

                if (rateLimitRemaining === '0') {
                    let resetMessage = '';
                    if (rateLimitReset) {
                        const resetDate = new Date(Number(rateLimitReset) * 1000);
                        resetMessage = ` Limit resets at ${resetDate.toLocaleTimeString()}.`;
                    }
                    return new ExtensionError(
                        `GitHub API rate limit exceeded.${resetMessage} Consider setting a personal access token.`,
                        ErrorCode.NETWORK_ERROR,
                        true
                    );
                }
                return new ExtensionError(
                    'Access forbidden. Your token may lack required permissions.',
                    ErrorCode.NETWORK_ERROR,
                    false
                );
            }
            case 404:
                return new ExtensionError(
                    'Resource not found on GitHub',
                    ErrorCode.NOT_FOUND,
                    false
                );
            case 500:
            case 502:
            case 503:
            case 504:
                return new ExtensionError(
                    'GitHub server error. Please try again later.',
                    ErrorCode.NETWORK_ERROR,
                    true
                );
            default:
                return new ExtensionError(
                    `GitHub API error (${statusCode}): ${responseBody}`,
                    ErrorCode.NETWORK_ERROR,
                    true
                );
        }
    }
}
