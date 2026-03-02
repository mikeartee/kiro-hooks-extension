# Kiro Hooks Browser

Browse, preview, and install community Kiro agent hooks directly from VS Code.

## What are Kiro Hooks?

Kiro hooks are automation rules that trigger agent actions based on IDE events — file saves, task completions, commits, and more. They live in your workspace at `.kiro/hooks/` and are picked up automatically by Kiro.

Examples of what hooks can do:

- Run linting when you save a TypeScript file
- Sync `.env.example` when you edit `.env`
- Update barrel exports when you create a new source file
- Review staged changes before a commit

## Features

- Browse hooks organized by category (Code Quality, Testing, Workflow, Security, Maintenance)
- Single-click install and uninstall with a green indicator showing what's active
- Preview hook JSON before installing
- Automatic update detection with one-click updates
- GitHub token support for higher API rate limits

## Getting Started

1. Open the **Kiro** panel in the Explorer sidebar
2. Expand **Hooks Browser**
3. Click any hook to install it — click again to uninstall
4. Right-click a hook for preview and update options

Installed hooks are written to `.kiro/hooks/` in your workspace and are immediately active.

## GitHub Token (Optional)

The extension works without a token but is subject to GitHub's unauthenticated rate limit (60 requests/hour). To increase this:

1. Open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`)
2. Run **Kiro Hooks: Set GitHub Token**
3. Paste a GitHub Personal Access Token with `public_repo` scope

## Configuration

| Setting | Default | Description |
|---|---|---|
| `kiroHooks.repository` | `mikeartee/kiro-hooks-docs` | GitHub repo containing hook definitions |
| `kiroHooks.branch` | `main` | Branch to fetch hooks from |
| `kiroHooks.cacheTimeout` | `3600` | Cache timeout in seconds |
| `kiroHooks.autoCheckUpdates` | `true` | Check for updates on activation |

## Hook Library

The hook library lives at [github.com/mikeartee/kiro-hooks-docs](https://github.com/mikeartee/kiro-hooks-docs). Contributions welcome — add a JSON file to the appropriate category folder and open a PR.

## License

MIT

