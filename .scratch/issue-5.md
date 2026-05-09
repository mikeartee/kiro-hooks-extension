Sub-issue of #1.

## Problem

Two issues with `HooksTreeProvider`:

1. `getRootItems()` calls `fetchData()` on every tree expand/collapse. If the user rapidly expands the tree, multiple concurrent fetches fire simultaneously, each overwriting `remoteHooks` and `installedHooks` mid-render.
2. Category labels are derived by title-casing the category ID (e.g. `code-quality` → `Code Quality`), ignoring the `label` and `description` fields already present in `categories.json`. This means the tree can't show the correct label if the ID and label differ, and tooltips are always empty.

## Work

- Add a `fetchPromise: Promise<void> | null` guard to `HooksTreeProvider` — if a fetch is already in flight, return the existing promise instead of starting a new one. Clear it when the fetch completes.
- Update `HookService.fetchHookList()` to return `{ hooks: HookMetadata[], categories: CategoryDefinition[] }` (or expose a separate `fetchCategories()` method) so category metadata is available to the tree provider
- Update `HooksTreeProvider` to use `CategoryDefinition.label` and `CategoryDefinition.description` for category tree items

## Acceptance criteria

- Rapid expand/collapse does not trigger multiple concurrent GitHub fetches
- Category tree items show the `label` from `categories.json` (e.g. "Code Quality" not derived from ID)
- Category tooltips show the `description` from `categories.json`
