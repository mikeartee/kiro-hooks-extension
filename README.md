# Kiro Hooks Browser

Browse, preview, install, and get personalised recommendations for community Kiro agent hooks — directly from VS Code.

## What are Kiro Hooks?

Kiro hooks are automation rules that trigger agent actions based on IDE events — file saves, task completions, commits, and more. They live in your workspace at `.kiro/hooks/` and are picked up automatically by Kiro.

Examples of what hooks can do:

- Run linting when you save a TypeScript or Python file
- Sync `.env.example` when you edit `.env`
- Update barrel exports when you create a new source file
- Review staged changes before a commit
- Scan for hardcoded secrets on every file edit
- Run tests automatically after a spec task completes

## Features

- **Browse** hooks organised by category (Code Quality, Testing, Documentation, Security, Workflow, Maintenance)
- **Get Recommendations** — click ✨ to get a ranked list of hooks relevant to your project based on your workspace's languages, frameworks, and dependencies
- **Single-click install and uninstall** with colour-coded status indicators (green = installed, orange = update available)
- **Preview** hook JSON before installing
- **Automatic update detection** with one-click updates
- **GitHub token support** for higher API rate limits
- **Config hot-reload** — changing the repository or branch in settings takes effect immediately, no restart needed

## Getting Started

1. Open the **Kiro** panel in the Explorer sidebar
2. Expand **Hooks Browser**
3. Click any hook to install it — click again to uninstall
4. Right-click a hook for preview and update options

Installed hooks are written to `.kiro/hooks/` in your workspace and are immediately active.

## Get Recommendations

Click the **✨ sparkle button** in the Hooks Browser title bar (or run **Kiro Hooks: Get Recommendations** from the Command Palette) to get a personalised list of hooks for your project.

The extension analyses your workspace — detecting languages, frameworks, dependencies, and project structure — and scores each hook for relevance. Select one or more from the list and press Enter to install them all at once.

Works best when your workspace has a `package.json` or `tsconfig.json`. Projects without either will still work but may return fewer results.

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
