# Issue Tracker — GitHub Issues

Issues for this repository live in **GitHub Issues** at:
https://github.com/mikeartee/kiro-hooks-extension/issues

## CLI

All issue operations use the [`gh` CLI](https://cli.github.com/).

```bash
# Create an issue
gh issue create --repo mikeartee/kiro-hooks-extension --title "..." --body "..." --label "needs-triage"

# List open issues
gh issue list --repo mikeartee/kiro-hooks-extension

# View an issue
gh issue view <number> --repo mikeartee/kiro-hooks-extension

# Close an issue
gh issue close <number> --repo mikeartee/kiro-hooks-extension

# Add a label
gh issue edit <number> --repo mikeartee/kiro-hooks-extension --add-label "ready-for-agent"

# Remove a label
gh issue edit <number> --repo mikeartee/kiro-hooks-extension --remove-label "needs-triage"

# Add a comment
gh issue comment <number> --repo mikeartee/kiro-hooks-extension --body "..."

# Link a sub-issue (parent/child)
gh issue edit <child-number> --repo mikeartee/kiro-hooks-extension --add-parent <parent-number>
```

## Conventions

- Every new issue gets the `needs-triage` label on creation.
- Sub-issues are linked to their parent PRD issue via the parent field.
- Closing keywords in PR bodies (`Closes #<number>`) auto-close the linked issue on merge.
