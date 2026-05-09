Sub-issue of #1.

## Problem

All hook matching in `installHook`, `updateHook`, `checkForUpdates`, and `getHooksForCategory` uses base-name string matching instead of `hook.path`. Two hooks in different categories with the same filename are treated as the same hook — one gets incorrectly marked as installed, updates target the wrong file, and installs land flat in `.kiro/hooks/` instead of the correct category subfolder.

## Work

- Fix `installHook` to write to `.kiro/hooks/<category>/<basename>.kiro.hook` using `hook.path`
- Fix `updateHook` to resolve the file path from `hook.path`
- Fix `checkForUpdates` to match installed hooks to remote hooks by full path
- Fix `getHooksForCategory` in `HooksTreeProvider` to match installed hooks by path
- On activation, run a one-time migration: scan `.kiro/hooks/` for flat-installed hooks, match each against the remote hook list by base name, and move them to the correct category-prefixed path

## Acceptance criteria

- A hook at `code-quality/lint-on-save.json` installs to `.kiro/hooks/code-quality/lint-on-save.kiro.hook`
- Two hooks with the same filename in different categories are independently tracked
- Existing flat-installed hooks are automatically moved to their correct paths on first activation after the update
- All existing `bugConditionExploration.test.ts` and `preservationTests.test.ts` tests pass
