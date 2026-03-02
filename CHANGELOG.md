# Changelog

## [0.2.1] - 2026-03-02

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

