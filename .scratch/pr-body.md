## Summary

Fixes all identified bugs, design issues, and schema inconsistencies in the kiro-hooks-extension and kiro-hooks-docs repos.

## Slices integrated

In wave order:

**Wave 1 (parallel):**
- `B4 — fetchHookList NOT_FOUND handling` — #4
- `D1+D2 — GitHubClient unification and unit tests` — #5
- `D5 — Virtual document provider for hook preview` — #7
- `D6+D7+D8 — Auto-update dedup, config listener, cacheTimeout` — #8

**Wave 2:**
- `B1+B2 — Path-based hook matching and flat-install migration` — #2

**Wave 3 (parallel):**
- `B3+B5 — clearCache race condition and checkForUpdates early return` — #3
- `D3+D4 — Tree fetch guard and category labels from categories.json` — #6

**Pre-applied (schema alignment):**
- `S1+S2+S3 — Schema alignment: semver versions, enabled field, tags` — #9

## Closes

Closes #1
Closes #2
Closes #3
Closes #4
Closes #5
Closes #6
Closes #7
Closes #8
Closes #9

---
Integrated by `/tdd-parallel` across 3 waves.
