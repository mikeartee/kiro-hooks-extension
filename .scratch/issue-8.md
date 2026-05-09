Sub-issue of #1. Also touches `mikeartee/kiro-hooks-docs`.

## Problem

Three schema inconsistencies between the docs repo and the extension type definitions:

1. All hook JSON files in `kiro-hooks-docs` use `"version": "1"` (a string integer) but `KiroHookSchema` expects semver. The extension defaults to `"1.0.0"` when the field is missing, masking the inconsistency.
2. Every hook file includes `"enabled": true` but `KiroHookSchema` has no `enabled` field — it's silently ignored.
3. `tags?: string[]` exists on `HookMetadata` and is always `[]` — nothing in `KiroHookSchema` or `fetchHooksFromDirectory` populates it, and the tree tooltip never shows it.

## Work

**In `kiro-hooks-docs`:**
- Update all hook JSON files: change `"version": "1"` to `"1.0.0"`
- Add `"tags": []` to each hook file (empty array is fine as a starting point)

**In `kiro-hooks-extension`:**
- Add `enabled?: boolean` to `KiroHookSchema` in `models/types.ts`
- Add `tags?: string[]` to `KiroHookSchema` in `models/types.ts`
- In `fetchHooksFromDirectory`, populate `tags` from `schema.tags ?? []`
- In `HooksTreeProvider.buildTooltip`, add tags to the tooltip when present (e.g. `Tags: typescript, eslint`)

## Acceptance criteria

- All hook JSON files in `kiro-hooks-docs` have `"version": "1.0.0"` and `"tags": []`
- `KiroHookSchema` has `enabled?: boolean` and `tags?: string[]`
- Tags from hook JSON appear in the tree tooltip
- No TypeScript errors
