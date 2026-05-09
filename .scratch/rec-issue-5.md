Sub-issue of #11. Independent — can run in parallel with all other slices.

## Problem

All 14 hooks in `kiro-hooks-docs` currently have `"tags": []`. The recommendation scoring system matches hooks to workspaces via tags, so empty tags mean no hooks will ever be recommended.

## Work

Update the `tags` array in each hook JSON file in `kiro-hooks-docs`:

**code-quality/lint-on-save.json**
```json
"tags": ["typescript", "javascript", "eslint", "linting"]
```

**code-quality/markdown-lint.json**
```json
"tags": ["markdown", "documentation", "linting"]
```

**code-quality/python-lint-on-save.json**
```json
"tags": ["python", "linting", "ruff", "flake8"]
```

**testing/run-tests-after-task.json**
```json
"tags": ["testing", "ci", "automation"]
```

**testing/generate-test-skeleton.json**
```json
"tags": ["testing", "typescript", "javascript"]
```

**testing/update-tests-on-source-change.json**
```json
"tags": ["testing", "typescript", "javascript", "python"]
```

**testing/barrel-export-update.json**
```json
"tags": ["typescript", "javascript", "modules"]
```

**documentation/sync-api-docs.json**
```json
"tags": ["documentation", "api", "typescript", "javascript"]
```

**security/scan-for-secrets.json**
```json
"tags": ["security", "secrets", "credentials"]
```

**workflow/pre-commit-review.json**
```json
"tags": ["workflow", "git", "code-review"]
```

**maintenance/cleanup-dead-imports.json**
```json
"tags": ["typescript", "javascript", "maintenance", "imports"]
```

**maintenance/dependency-audit.json**
```json
"tags": ["security", "dependencies", "npm", "maintenance"]
```

**maintenance/env-example-sync.json**
```json
"tags": ["maintenance", "environment", "configuration"]
```

**maintenance/lockfile-sync-check.json**
```json
"tags": ["maintenance", "npm", "dependencies"]
```

Commit to `kiro-hooks-docs` main branch directly (no PR needed for content-only changes to the docs repo).

## Acceptance criteria

- All 14 hook JSON files have non-empty `tags` arrays
- Tags are meaningful and match the hook's purpose
- JSON files remain valid (no syntax errors)
