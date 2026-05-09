# Ship Style — Pull Request

All changes to this repository go through a pull request. No direct pushes to `main`.

## Workflow

1. **Create a feature branch** from `main`:
   ```bash
   git checkout main && git pull
   git checkout -b <type>/<issue-number>-<short-slug>
   ```
   Branch naming convention: `fix/42-cache-race-condition`, `feat/17-config-change-listener`

2. **Implement and commit** on the feature branch. Commit messages should be imperative and reference the issue:
   ```
   fix: await clearCache() to prevent stale data race (#42)
   ```

3. **Push and open a PR**:
   ```bash
   git push -u origin <branch>
   gh pr create --repo mikeartee/kiro-hooks-extension \
     --title "<concise title under 70 chars>" \
     --body "$(printf 'Closes #<issue-number>\n\n## Summary\n...\n\n## Tested\n...')" \
     --base main
   ```
   The `Closes #<number>` keyword in the PR body auto-closes the linked issue when the PR is merged.

4. **Human reviews and merges.** Skills do not merge PRs.

## Rules

- Never push directly to `main`.
- Always include `Closes #<issue-number>` in the PR body.
- Keep PR titles under 70 characters; put detail in the description.
- One logical change per PR — don't bundle unrelated fixes.
