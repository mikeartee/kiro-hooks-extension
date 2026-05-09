/**
 * GitHubClient Unit Tests
 *
 * Tests the unified makeRequestWithRetry method via the public API
 * (getRepositoryContents and getRawFileContent).
 *
 * The HttpGetFn dependency is injected into GitHubClient so tests can
 * supply a fake implementation without touching the real https module.
 * Fake responses are built with EventEmitter to simulate Node's IncomingMessage.
 */

import * as assert from 'assert';
import { EventEmitter } from 'events';
import { GitHubClient, HttpGetFn } from '../../services/GitHubClient';
import { ExtensionError, ErrorCode } from '../../models/types';
import type { IncomingMessage, ClientRequest } from 'http';

// ---------------------------------------------------------------------------
// Fake HTTP primitives
// ---------------------------------------------------------------------------

/**
 * Minimal fake of IncomingMessage — only the fields GitHubClient reads.
 */
class FakeResponse extends EventEmitter {
    statusCode: number;
    headers: Record<string, string>;

    constructor(statusCode: number, headers: Record<string, string> = {}) {
        super();
        this.statusCode = statusCode;
        this.headers = headers;
    }

    /** Emit data + end on the next tick so listeners are registered first. */
    send(body: string): void {
        process.nextTick(() => {
            this.emit('data', body);
            this.emit('end');
        });
    }
}

/**
 * Minimal fake of ClientRequest — only the events GitHubClient listens to.
 */
class FakeRequest extends EventEmitter {
    destroy(): void { /* no-op */ }
}

// ---------------------------------------------------------------------------
// Factory helpers
// ---------------------------------------------------------------------------

/**
 * Build a GitHubClient that uses the supplied fake httpGet.
 */
function makeClient(fakeGet: HttpGetFn, token?: string): GitHubClient {
    return new GitHubClient(
        'owner/repo',
        'main',
        async () => token,
        fakeGet
    );
}

/**
 * Build a simple fake httpGet that responds with the given status + body.
 * Captures the options object so tests can inspect headers.
 */
function makeFakeGet(
    statusCode: number,
    body: string,
    responseHeaders: Record<string, string> = {}
): { httpGet: HttpGetFn; capturedOptions: { headers?: Record<string, string> } } {
    const capturedOptions: { headers?: Record<string, string> } = {};

    const httpGet: HttpGetFn = (_url, options, cb) => {
        capturedOptions.headers = options.headers as Record<string, string>;
        const res = new FakeResponse(statusCode, responseHeaders);
        const req = new FakeRequest();
        cb(res as unknown as IncomingMessage);
        res.send(body);
        return req as unknown as ClientRequest;
    };

    return { httpGet, capturedOptions };
}

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

suite('GitHubClient Unit Tests', () => {

    // -----------------------------------------------------------------------
    // Test 1 — Successful JSON response (200) returns parsed object
    // -----------------------------------------------------------------------
    suite('Test 1 — Successful JSON response', () => {
        test('getRepositoryContents returns parsed array on 200', async () => {
            const payload = [
                {
                    name: 'hook.json', path: 'git/hook.json', sha: 'abc', size: 100,
                    type: 'file', url: '', html_url: '', git_url: '', download_url: ''
                }
            ];
            const { httpGet } = makeFakeGet(200, JSON.stringify(payload));
            const client = makeClient(httpGet, 'token123');

            const result = await client.getRepositoryContents('git');

            assert.ok(Array.isArray(result), 'Result should be an array');
            assert.strictEqual(result.length, 1);
            assert.strictEqual(result[0].name, 'hook.json');
        });
    });

    // -----------------------------------------------------------------------
    // Test 2 — Successful raw response (200) returns string
    // -----------------------------------------------------------------------
    suite('Test 2 — Successful raw response', () => {
        test('getRawFileContent returns raw string on 200', async () => {
            const rawContent = '{"name":"hook","version":"1.0.0"}';
            const { httpGet } = makeFakeGet(200, rawContent);
            const client = makeClient(httpGet, 'token123');

            const result = await client.getRawFileContent('git/hook.json');

            assert.strictEqual(result, rawContent);
        });
    });

    // -----------------------------------------------------------------------
    // Test 3 — HTTP 401 throws ExtensionError with NETWORK_ERROR, non-recoverable
    // -----------------------------------------------------------------------
    suite('Test 3 — HTTP 401 non-recoverable', () => {
        test('401 throws non-recoverable ExtensionError with NETWORK_ERROR', async () => {
            const { httpGet } = makeFakeGet(401, 'Unauthorized');
            const client = makeClient(httpGet, 'bad-token');

            let thrown: unknown;
            try {
                await client.getRawFileContent('some/file.json');
            } catch (err) {
                thrown = err;
            }

            assert.ok(thrown instanceof ExtensionError, 'Should throw ExtensionError');
            assert.strictEqual((thrown as ExtensionError).code, ErrorCode.NETWORK_ERROR);
            assert.strictEqual((thrown as ExtensionError).recoverable, false,
                '401 should be non-recoverable');
        });
    });

    // -----------------------------------------------------------------------
    // Test 4 — HTTP 403 with x-ratelimit-remaining: 0 throws recoverable error
    // -----------------------------------------------------------------------
    suite('Test 4 — HTTP 403 rate limit exceeded (recoverable)', () => {
        test('403 with x-ratelimit-remaining: 0 throws recoverable ExtensionError', async () => {
            const { httpGet } = makeFakeGet(403, 'rate limit exceeded', {
                'x-ratelimit-remaining': '0'
            });
            const client = makeClient(httpGet);

            let thrown: unknown;
            try {
                await client.getRawFileContent('some/file.json');
            } catch (err) {
                thrown = err;
            }

            assert.ok(thrown instanceof ExtensionError, 'Should throw ExtensionError');
            assert.strictEqual((thrown as ExtensionError).code, ErrorCode.NETWORK_ERROR);
            assert.strictEqual((thrown as ExtensionError).recoverable, true,
                '403 rate limit should be recoverable');
            assert.ok(
                (thrown as ExtensionError).message.includes('rate limit'),
                'Message should mention rate limit'
            );
        });
    });

    // -----------------------------------------------------------------------
    // Test 5 — HTTP 403 without rate limit header throws non-recoverable error
    // -----------------------------------------------------------------------
    suite('Test 5 — HTTP 403 forbidden (non-recoverable)', () => {
        test('403 without x-ratelimit-remaining: 0 throws non-recoverable ExtensionError', async () => {
            // No x-ratelimit-remaining header
            const { httpGet } = makeFakeGet(403, 'Forbidden', {});
            const client = makeClient(httpGet, 'token');

            let thrown: unknown;
            try {
                await client.getRawFileContent('some/file.json');
            } catch (err) {
                thrown = err;
            }

            assert.ok(thrown instanceof ExtensionError, 'Should throw ExtensionError');
            assert.strictEqual((thrown as ExtensionError).code, ErrorCode.NETWORK_ERROR);
            assert.strictEqual((thrown as ExtensionError).recoverable, false,
                '403 forbidden (no rate limit) should be non-recoverable');
        });
    });

    // -----------------------------------------------------------------------
    // Test 6 — HTTP 404 throws ExtensionError with NOT_FOUND code
    // -----------------------------------------------------------------------
    suite('Test 6 — HTTP 404 NOT_FOUND', () => {
        test('404 throws ExtensionError with NOT_FOUND code', async () => {
            const { httpGet } = makeFakeGet(404, 'Not Found');
            const client = makeClient(httpGet, 'token');

            let thrown: unknown;
            try {
                await client.getRawFileContent('missing/file.json');
            } catch (err) {
                thrown = err;
            }

            assert.ok(thrown instanceof ExtensionError, 'Should throw ExtensionError');
            assert.strictEqual((thrown as ExtensionError).code, ErrorCode.NOT_FOUND);
            assert.strictEqual((thrown as ExtensionError).recoverable, false,
                '404 should be non-recoverable');
        });
    });

    // -----------------------------------------------------------------------
    // Test 7 — HTTP 500 throws recoverable ExtensionError
    // -----------------------------------------------------------------------
    suite('Test 7 — HTTP 500 recoverable server error', () => {
        test('500 throws recoverable ExtensionError', async () => {
            const { httpGet } = makeFakeGet(500, 'Internal Server Error');
            const client = makeClient(httpGet, 'token');

            let thrown: unknown;
            try {
                await client.getRawFileContent('some/file.json');
            } catch (err) {
                thrown = err;
            }

            assert.ok(thrown instanceof ExtensionError, 'Should throw ExtensionError');
            assert.strictEqual((thrown as ExtensionError).code, ErrorCode.NETWORK_ERROR);
            assert.strictEqual((thrown as ExtensionError).recoverable, true,
                '500 should be recoverable');
        });
    });

    // -----------------------------------------------------------------------
    // Test 8 — Retry on recoverable error — retries up to maxRetries, then throws
    // -----------------------------------------------------------------------
    suite('Test 8 — Retry on recoverable error', () => {
        test('retries up to maxRetries (3) on recoverable errors then throws', async () => {
            let callCount = 0;

            const httpGet: HttpGetFn = (_url, _options, cb) => {
                callCount++;
                const res = new FakeResponse(500);
                const req = new FakeRequest();
                cb(res as unknown as IncomingMessage);
                res.send('Server Error');
                return req as unknown as ClientRequest;
            };

            // Use a subclass that overrides delay to avoid slow tests
            class FastRetryClient extends GitHubClient {
                // We can't easily override the private delay without exposing it,
                // so we accept the test will take ~3s (1+2 second delays).
                // The important assertion is the call count.
            }

            const client = new FastRetryClient('owner/repo', 'main', async () => 'token', httpGet);

            let thrown: unknown;
            try {
                await client.getRawFileContent('some/file.json');
            } catch (err) {
                thrown = err;
            }

            assert.ok(thrown instanceof ExtensionError, 'Should throw ExtensionError after retries');
            assert.strictEqual((thrown as ExtensionError).recoverable, true,
                'Final thrown error should be the last recoverable error');
            assert.strictEqual(callCount, 3, 'Should have attempted exactly 3 times (maxRetries)');
        }).timeout(15000); // allow time for retry delays
    });

    // -----------------------------------------------------------------------
    // Test 9 — No retry on non-recoverable error — throws immediately
    // -----------------------------------------------------------------------
    suite('Test 9 — No retry on non-recoverable error', () => {
        test('throws immediately on 401 without retrying', async () => {
            let callCount = 0;

            const httpGet: HttpGetFn = (_url, _options, cb) => {
                callCount++;
                const res = new FakeResponse(401);
                const req = new FakeRequest();
                cb(res as unknown as IncomingMessage);
                res.send('Unauthorized');
                return req as unknown as ClientRequest;
            };

            const client = makeClient(httpGet, 'bad-token');

            let thrown: unknown;
            try {
                await client.getRawFileContent('some/file.json');
            } catch (err) {
                thrown = err;
            }

            assert.ok(thrown instanceof ExtensionError, 'Should throw ExtensionError');
            assert.strictEqual((thrown as ExtensionError).recoverable, false);
            assert.strictEqual(callCount, 1,
                'Should have attempted exactly once (no retry on non-recoverable)');
        });
    });

    // -----------------------------------------------------------------------
    // Test 10 — Token present — Authorization header included in request
    // -----------------------------------------------------------------------
    suite('Test 10 — Token present in Authorization header', () => {
        test('Authorization header is set when token is provided', async () => {
            const { httpGet, capturedOptions } = makeFakeGet(200, JSON.stringify([]));
            const client = makeClient(httpGet, 'my-secret-token');

            await client.getRepositoryContents('git');

            assert.ok(capturedOptions.headers, 'Options should have headers');
            assert.strictEqual(
                capturedOptions.headers!['Authorization'],
                'Bearer my-secret-token',
                'Authorization header should be set with Bearer token'
            );
        });
    });

    // -----------------------------------------------------------------------
    // Test 11 — Token absent — Authorization header omitted
    // -----------------------------------------------------------------------
    suite('Test 11 — Token absent — Authorization header omitted', () => {
        test('Authorization header is NOT set when no token is provided', async () => {
            const { httpGet, capturedOptions } = makeFakeGet(200, JSON.stringify([]));
            // No token
            const client = makeClient(httpGet, undefined);

            await client.getRepositoryContents('git');

            assert.ok(capturedOptions.headers, 'Options should have headers');
            assert.strictEqual(
                capturedOptions.headers!['Authorization'],
                undefined,
                'Authorization header should NOT be set when no token is provided'
            );
        });
    });

    // -----------------------------------------------------------------------
    // Test 12 — getRepositoryContents with non-array 200 body throws PARSE_ERROR
    // -----------------------------------------------------------------------
    suite('Test 12 — Non-array 200 body throws PARSE_ERROR', () => {
        test('getRepositoryContents throws PARSE_ERROR when 200 body is not an array', async () => {
            // GitHub API returns a single object (e.g. a file, not a directory)
            const { httpGet } = makeFakeGet(200, JSON.stringify({ name: 'file.json', type: 'file' }));
            const client = makeClient(httpGet, 'token');

            let thrown: unknown;
            try {
                await client.getRepositoryContents('some/path');
            } catch (err) {
                thrown = err;
            }

            assert.ok(thrown instanceof ExtensionError, 'Should throw ExtensionError');
            assert.strictEqual((thrown as ExtensionError).code, ErrorCode.PARSE_ERROR);
            assert.strictEqual((thrown as ExtensionError).recoverable, false,
                'PARSE_ERROR should be non-recoverable');
        });
    });

});
