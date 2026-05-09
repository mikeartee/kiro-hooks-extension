Sub-issue of #11. Depends on #14 (HookMatcher + RecommendationService).

## Problem

The recommendation engine exists but there's no way for users to trigger it. We need a command, a QuickPick UI, and a tree view button.

## Work

**Create `src/commands/recommendHooks.ts`**:

```typescript
export async function recommendHooks(
    recommendationService: RecommendationService,
    hookService: HookService,
    treeProvider: HooksTreeProvider
): Promise<void> {
    // 1. Show progress notification "Analysing workspace..."
    // 2. Call recommendationService.getRecommendations()
    // 3. If empty, show info message "No recommendations found for your workspace"
    // 4. Build QuickPick items:
    //    label: hook.name
    //    description: top match reason description (or "Recommended for your project")
    //    detail: hook.description
    //    picked: false
    // 5. Show multi-select QuickPick with title "✨ Recommended Hooks"
    //    placeholder: "Select hooks to install, then press Enter"
    // 6. On accept: bulk-install all selected hooks via hookService.installHook()
    //    with progress notification "Installing N hooks..."
    // 7. Refresh treeProvider
    // 8. Show success message "Installed N hooks"
}
```

**Register command in `src/commands/index.ts`**:
```typescript
import { recommendHooks } from './recommendHooks';
// ...
vscode.commands.registerCommand('kiroHooks.recommend', async () => {
    await recommendHooks(recommendationService, hookService, treeProvider);
});
```

Update `registerCommands` signature to accept `recommendationService`.

**Wire up in `extension.ts`**:
```typescript
import { WorkspaceAnalyzer } from './services/WorkspaceAnalyzer';
import { WorkspaceAnalysisCache } from './services/WorkspaceAnalysisCache';
import { HookMatcher } from './services/HookMatcher';
import { RecommendationService } from './services/RecommendationService';

const workspaceAnalyzer = new WorkspaceAnalyzer();
const workspaceAnalysisCache = new WorkspaceAnalysisCache(workspaceAnalyzer);
const hookMatcher = new HookMatcher();
const recommendationService = new RecommendationService(hookService, workspaceAnalysisCache, hookMatcher);
```

Pass `recommendationService` to `registerCommands`.

**Update `package.json`**:
- Add command: `{ "command": "kiroHooks.recommend", "title": "Get Recommendations", "category": "Kiro Hooks", "icon": "$(sparkle)" }`
- Add to `view/title` menu: `{ "command": "kiroHooks.recommend", "when": "view == kiroHooksView", "group": "navigation" }`

## Acceptance criteria

- "Get Recommendations" button appears in the tree view title bar
- `Ctrl+Shift+P` → "Kiro Hooks: Get Recommendations" works
- Selecting hooks in the QuickPick and pressing Enter installs them all
- Empty recommendations show a friendly info message instead of an empty picker
- Tree refreshes after installation
