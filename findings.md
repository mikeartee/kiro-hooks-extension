# Findings: Kiro Hooks Extension

## Key Decisions

- **Separate repo from steering-docs-extension**: Hooks and steering docs are separate panels
  in the Kiro sidebar, so two extensions feels natural. Separate repos keep concerns clean.
- **Mirror steering-docs-extension architecture**: Proven pattern, same GitHub API approach,
  same tree view + install flow. Reduces build risk significantly.
- **Content repo is separate from extension repo**: Same pattern as steering-docs. The extension
  is the distribution mechanism; the hooks library is the content.
- **`.claude/` is gitignored in extension repos**: Confirmed in steering-docs-extension.
  Personal reference docs go there safely.

## Market Research

- No existing VS Code extension distributes Kiro hooks as a browsable/installable library
- `kiro.dev` has official hook docs and examples — good seed content
- `awsdataarchitect/kiro-best-practices` repo contains hooks as part of boilerplate
- `kiro.directory` has hook guides — another source for content
- The gap is distribution infrastructure, not content (content already exists scattered)
- VoltAgent subagents repo is the closest analogue in Claude Code ecosystem (140+ agents,
  plugin-based distribution) — but Claude Code specific, not portable to Kiro

## Boris Cherny / Claude Code Patterns (Relevant Inspiration)

- `postToolUse` hooks for auto-formatting — fires after every write, keeps CI clean
- `verify-app` subagent triggered by hooks — proves hooks + agents compose well
- Gap analysis loop pattern: agent with self-directed loop instruction, hook triggers it
- Skills orchestrate subagents; hooks trigger the whole system automatically
- Context isolation via subagents prevents "context pollution" in multi-phase workflows

## Monetisation Angle

- Raw hook files have no moat — trivially copyable
- Value is in curation, composition, and distribution infrastructure
- Potential model: free community library, paid "pro workflow packs" (tested, composable bundles)
- Extension itself as free tool + premium content tier is cleanest VS Code monetisation pattern
- Education/consulting angle: most devs don't know how to compose hooks + steering + agents

## Dead Ends (Do Not Retry)

- Trying to port VoltAgent subagents directly to Kiro — wrong format, wrong system
- Combining hooks extension with steering-docs extension — creates awkward coupling,
  mismatches Kiro's own UI separation

## Hook Examples to Seed Content Repo

### Official kiro.dev schema (JSON format, lives in .kiro/hooks/)

```json
{
  "name": "Hook Name",
  "version": "1.0.0",
  "description": "What this hook does",
  "when": {
    "type": "fileEdited|fileCreated|fileDeleted|userTriggered|promptSubmit|agentStop|preToolUse|postToolUse|preTaskExecution|postTaskExecution",
    "patterns": ["**/*.ts"],
    "toolTypes": ["write", "read", "shell"]
  },
  "then": {
    "type": "askAgent|runCommand",
    "prompt": "string (askAgent only)",
    "command": "string (runCommand only)"
  }
}
```

### Confirmed hook categories from research

**Code Quality**

- `fileEdited` (*.ts, *.tsx) → run getDiagnostics / lint
- `fileEdited` (*.md) → run markdownlint
- `postToolUse` (write) → enforce coding standards
- `fileEdited` (src/**/*.{js,ts}) → update JSDoc / README if API changed

**Security**

- `fileEdited` (**/*) → scan for secrets, credentials, hardcoded passwords
- `fileEdited` (**/routes/**) → check for injection vulnerabilities

**Testing**

- `fileCreated` (src/**/*.{js,ts,jsx,tsx}) → generate test file skeleton
- `postTaskExecution` → run test suite after task completes

**Documentation**

- `fileEdited` (**/routes/**/*.{js,ts}) → sync OpenAPI/README
- `fileDeleted` (**/*.{js,ts}) → clean up dangling imports and doc references

**Workflow / Spec**

- `postTaskExecution` → gap analysis verification loop (the Boris pattern)
- `agentStop` → summarise what was done, update progress.md
- `preTaskExecution` → validate prerequisites before task starts
- `promptSubmit` → remind agent of key rules from steering docs
- `preToolUse` (write) → check operation follows coding standards

**Maintenance**

- `fileEdited` (**/package.json) → audit dependencies, update docs
- `userTriggered` → on-demand code quality audit

### Key insight from kiro.directory research

Hook files in `.kiro/hooks/` are markdown files (not JSON) based on community examples —
the JSON schema above is what Kiro's UI generates, but the actual hook content/prompt
is markdown. Need to verify exact format against official docs before building extension.

### Note on kiro.directory examples

Their hook examples use a markdown format with trigger/pattern as comments, not the
JSON schema shown in Kiro's official UI. This inconsistency needs resolving — the
extension must install the correct format that Kiro actually reads.

