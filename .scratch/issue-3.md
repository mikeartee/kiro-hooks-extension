Sub-issue of #1.

## Problem

When `categories.json` returns a 404 (e.g. on a fresh or misconfigured repo), `fetchHookList` propagates the `NOT_FOUND` error to the caller instead of handling it gracefully. The tree view shows an error message instead of an empty state with a helpful warning.

## Work

- In `fetchHookList`, catch `ExtensionError` with `code === ErrorCode.NOT_FOUND` and return `[]` with a `vscode.window.showWarningMessage` instead of re-throwing
- Ensure non-NOT_FOUND errors (401, 403, 5xx) still propagate

## Acceptance criteria

- When `categories.json` is missing, the tree shows empty with a warning notification — no error thrown
- Auth errors and network errors still surface to the user
- `bugConditionExploration.test.ts` Bug 1.3 test passes
