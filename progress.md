# Progress: Kiro Hooks Extension

## Status

In progress

## Last Completed Step

Step 6 — Extension scaffolded and compiling clean.

- Hook format resolved: JSON files in `.kiro/hooks/` (confirmed from official Kiro schema)
- `kiro-hooks-extension/` fully scaffolded: package.json, tsconfig, eslint, all src files
- `kiro-hooks-docs/` seeded: categories.json + 9 hooks across 6 categories
- TypeScript compiles with zero errors

## Completed Steps

- [x] 1. Planning docs created
- [x] 2. Hook format research and resolution (JSON, not markdown)
- [x] 3. Content repo structure defined (categories.json + category folders)
- [x] 4. Kickoff prompt written and executed
- [x] 5. kiro-hooks-docs content repo seeded with 9 hooks
- [x] 6. Extension scaffolded (mirrors steering-docs-extension architecture)

## Next Actions

- [ ] 7. Create GitHub repos: `mikeartee/kiro-hooks-extension` and `mikeartee/kiro-hooks-docs`
- [ ] 8. Push both repos to GitHub
- [ ] 9. Test the extension end-to-end (F5 in VS Code, verify tree view loads hooks)
- [ ] 10. Add more hooks to the content library (target: 20+ before publishing)
- [ ] 11. Package: `npx vsce package --allow-package-secrets github`
- [ ] 12. Publish to open-vsx

## Hook Format Resolution

Hooks are **JSON files** in `.kiro/hooks/`. The markdown examples on kiro.directory are
documentation guides, not the actual file format. The JSON schema in findings.md is correct.

The extension embeds a `_sha` field in installed hook JSON for update tracking
(same pattern as steering-docs uses frontmatter SHA).

## Blockers

None — ready to push to GitHub and test end-to-end.

