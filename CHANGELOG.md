# Changelog

## [0.3.0]

### Added
- Path-based hook matching — hooks now install to category-prefixed paths (e.g. `.kiro/hooks/code-quality/lint-on-save.kiro.hook`)
- Automatic migration of flat-installed hooks to correct category paths on activation
- Virtual document provider for hook preview — read-only, no double-insert, no save prompt
- Config change listener — changing `kiroHooks.repository` or `kiroHooks.branch` takes effect immediately without restart
- `kiroHooks.cacheTimeout` setting now respected (was previously hardcoded to 3600s)
- Category labels and descriptions now sourced from `categories.json` instead of derived from IDs
- Tree provider fetch guard — prevents redundant concurrent fetches on rapid expand/collapse
- `tags` field support in hook schema — tags shown in tree tooltip
- Unit tests for `GitHubClient` covering retry, error mapping, auth, and response handling
- New extension icon

### Fixed
- Hook install/update/update-check/installed-status all now use path-based matching (fixes false positives when two hooks share a filename across categories)
- `clearCache()` race condition — now properly awaited before refetch
- `checkForUpdates` no longer makes a GitHub API call when no hooks are installed
- `fetchHookList` now returns `[]` with a warning when `categories.json` is missing (404) instead of throwing

### Changed
- `GitHubClient` request methods unified — reduced duplication, same behaviour
- Auto-update check logic deduplicated between activation and the refresh command
- Hook schema: `version` field standardised to semver (`1.0.0`), `enabled` and `tags` fields documented

 - 2026-03-02

### Fixed

- Update detection bug: SHA matching now correctly compares base filenames across remote path format (`category/name.json`) and local format (`name.kiro.hook`)

### Added

- README.md with full usage documentation
- Marketplace metadata: icon field and improved categories

## [0.2.0] - 2026-03-02

### Changed

- Curated hook library: removed hooks that fired too broadly and caused noise
- Fixed `run-tests-after-task` command (removed vitest-specific `--run` flag)
- Improved `lockfile-sync-check` to detect and report lockfile presence

### Removed

- `enforce-coding-standards` (fired on every write operation — too noisy)
- `gap-analysis-loop` (fired on every task completion — too noisy)
- `todo-check-before-complete` (fired on every task completion — too noisy)
- `changelog-reminder` (fired on every task completion — too noisy)
- `context7-before-library-use` (fired on every task start — too noisy)
- `validate-prerequisites` (fired on every task start — too vague)
- `summarize-on-stop` (fired on every agent stop — too noisy)
- `update-readme-on-feature-change` (fired on every src file edit — too broad)
- `prettier-format-on-save` (`${file}` variable not supported in hook runner)
- `type-check-on-save` (too slow for large projects)
- `check-coverage-after-task` (coverage commands vary too much by project)

## [0.1.0] - 2026-02-01

### Added

- Initial release
- Browse hooks by category from GitHub repository
- Single-click install/uninstall with green indicator
- Preview hook content before installing
- Check for and apply updates to installed hooks
- GitHub token support for higher API rate limits

