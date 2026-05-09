Sub-issue of #1.

## Problem

`GitHubClient` has two nearly-identical method pairs: `makeRequest`/`makeRawRequest` and `makeRequestWithRetry`/`makeRawRequestWithRetry`. The only real differences are the response type (`unknown` vs `string`) and the `Accept` header. This duplication makes the retry logic and error handling harder to maintain and means any fix must be applied twice.

There are also no unit tests for `GitHubClient` — the existing test suite stubs it entirely, so bugs in retry logic, timeout handling, or error mapping go undetected.

## Work

- Refactor `GitHubClient` to use a single generic `makeRequestWithRetry<T>(url, options)` method with a response transformer function
- Remove the duplicate `makeRawRequest`/`makeRawRequestWithRetry` methods
- Add a new test file `src/test/suite/githubClient.test.ts` with unit tests covering:
  - Retry behaviour: retries on recoverable errors, stops on non-recoverable errors, exhausts max retries
  - HTTP error mapping: 401, 403 rate-limit (with reset header), 403 forbidden, 404, 500/502/503/504, default
  - Timeout: request is destroyed and a recoverable error is thrown
  - Token injection: `Authorization` header present when token set, absent when not
  - JSON response: parsed correctly
  - Raw response: returned as string

## Acceptance criteria

- `getRepositoryContents` and `getRawFileContent` behave identically to before
- All new unit tests pass
- No duplication in retry/request logic
