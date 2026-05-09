Sub-issue of #1.

## Problem

`handlePreview` opens hook content using `vscode.Uri.parse('untitled:<name>')` and inserts content via `WorkspaceEdit`. This has two bugs:
- If the user previews the same hook twice, the content is inserted again into the existing document, doubling it
- When the user closes the preview, VS Code prompts "Do you want to save the changes?" because the document is dirty

## Work

- Register a `vscode.workspace.registerTextDocumentContentProvider` for the `kiro-hook://` URI scheme in `extension.ts`
- The provider's `provideTextDocumentContent` method fetches and returns the hook JSON for a given hook path
- Update `handlePreview` in `commands/index.ts` to open `vscode.Uri.parse('kiro-hook://<hook.path>')` instead of the untitled URI approach
- The document is read-only by nature of the virtual provider — no dirty state, no save prompt, no double-insert

## Acceptance criteria

- Previewing the same hook twice opens the same document without duplicating content
- Closing the preview never prompts to save
- The preview document is read-only (edits are not persisted)
- Preview still opens beside the current editor
