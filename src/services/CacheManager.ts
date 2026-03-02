// External libraries
import * as vscode from 'vscode';

/**
 * Cache entry with TTL support
 */
interface CacheEntry<CacheValue> {
    value: CacheValue;
    timestamp: number;
    ttl?: number;
}

/**
 * CacheManager handles caching of data using VS Code's globalState with TTL support
 */
export class CacheManager {
    private readonly CACHE_PREFIX = 'kiroHooks.cache.';

    constructor(private readonly globalState: vscode.Memento) {}

    /**
     * Get a value from the cache, returns undefined if not found or expired
     */
    get<CacheValue>(key: string): CacheValue | undefined {
        const cacheKey = this.CACHE_PREFIX + key;
        const entry = this.globalState.get<CacheEntry<CacheValue>>(cacheKey);

        if (!entry) {
            return undefined;
        }

        if (entry.ttl !== undefined) {
            const age = Date.now() - entry.timestamp;
            if (age > entry.ttl * 1000) {
                void this.clear(key);
                return undefined;
            }
        }

        return entry.value;
    }

    /**
     * Set a value in the cache with optional TTL in seconds
     */
    async set<CacheValue>(key: string, value: CacheValue, ttl?: number): Promise<void> {
        const cacheKey = this.CACHE_PREFIX + key;
        const entry: CacheEntry<CacheValue> = {
            value,
            timestamp: Date.now(),
            ttl
        };
        await this.globalState.update(cacheKey, entry);
    }

    /**
     * Clear a specific cache entry, or all entries if no key provided
     */
    async clear(key?: string): Promise<void> {
        if (key) {
            await this.globalState.update(this.CACHE_PREFIX + key, undefined);
        } else {
            const keys = this.globalState.keys();
            for (const k of keys) {
                if (k.startsWith(this.CACHE_PREFIX)) {
                    await this.globalState.update(k, undefined);
                }
            }
        }
    }
}
