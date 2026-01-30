# Code Formatting Rules

This document outlines the code formatting and style rules for this project. These rules are mandatory and must be followed consistently.

## 1. Control Flow Statements Must Have Curly Braces

All control flow statements (`if`, `for`, `while`, etc.) **must** use curly braces, even for single-line bodies. No exceptions.

```typescript
// ✅ CORRECT
if (condition) {
    doSomething();
}

for (const item of items) {
    processItem(item);
}

// ❌ WRONG
if (condition) doSomething();

for (const item of items) processItem(item);
```

## 2. Single-Line Statements (Except Control Flow)

Keep all non-control-flow statements on a single logical line. Let the IDE formatter handle line breaks based on configured line width.

```typescript
// ✅ CORRECT - Let IDE handle line breaks
const result = await someService.performOperation(param1, param2, param3);
console.log(red(`❌ Error occurred: ${error.message}`), `(${context})`);

// ❌ WRONG - Manual line breaks in non-control-flow statements
const result = await someService.performOperation(
    param1,
    param2,
    param3
);
```

### Exception: Object Parameters with 3+ Properties

When passing an object literal as a function argument with **3 or more properties**, format it across multiple lines (one property per line) for readability.

```typescript
// ✅ CORRECT - 1-2 properties: keep inline
await someFunc({ key1, key2 });
const options = items.map((item) => ({ name: item.name, value: item.id }));

// ✅ CORRECT - 3+ properties: multi-line
await syncCommand({
    config: configFile,
    workspaceRoot,
    debug,
    concurrency,
});

const options = items.map((item) => ({
    name: item.name,
    value: item.id,
    checked: item.active,
}));

// ❌ WRONG - 3+ properties on single line (hard to read)
await syncCommand({ config: configFile, workspaceRoot, debug, concurrency });
```

## 3. Early-Return and Early-Continue Patterns

Use early-return and early-continue patterns to reduce nesting and improve readability. However, avoid careless returns in the middle of complex functions. Instead, extract such logic into dedicated helper functions.

```typescript
// ✅ CORRECT - Early-return in dedicated function
function processHookResult(hookResult: HookExecutionResult, path: string): void {
    if (hookResult.success) {
        console.log(green(`✅ Completed for ${path}`));
        return;
    }

    // Handle failure case
    console.log(yellow(`⚠️ Failed for ${path}`));
}

// ✅ CORRECT - Early-continue in loops
for (const item of items) {
    if (!item.isValid) {
        continue;
    }

    processItem(item);
}

// ❌ WRONG - Careless early-return in main function flow
async function mainCommand(): Promise<Result<void, Error>> {
    // ... lots of code ...
    if (someCondition) {
        return; // Dangerous! May skip important cleanup
    }
    // ... more code ...
}
```

## 4. Function Extraction for Complex Logic

Extract complex conditional logic into focused helper functions. This enables proper early-return patterns while maintaining clarity and correctness.

**Important**: Avoid over-extraction. Functions should have meaningful logic, not just wrap a single operation or add unnecessary abstraction layers.

### 4.1 Inline Arrow Functions with Control Flow

When an inline arrow function contains control flow statements (like `if`), extract it into a named function for readability.

```typescript
// ✅ CORRECT - Extracted error handler with control flow
function handleCheckboxError(error: unknown): Error {
    if (error instanceof Error && error.message.includes("cancelled")) {
        return wrapError("Operation cancelled", error);
    }
    return wrapError("Failed to prompt", error as Error);
}

const result = await Result.wrap(() => doSomething(), handleCheckboxError)();

// ❌ WRONG - Inline arrow with control flow (hard to read)
const result = await Result.wrap(() => doSomething(), (error) => {
    if (error instanceof Error && error.message.includes("cancelled")) {
        return wrapError("Operation cancelled", error);
    }
    return wrapError("Failed to prompt", error as Error);
})();
```

### 4.2 Complex Callback Logic

When a callback wraps complex logic (e.g., function calls with multi-line object parameters), extract it into a named function.

```typescript
// ✅ CORRECT - Extracted callback function
function promptForWorkspaceSelection(options: Array<CheckboxOption<string>>): Promise<string[]> {
    return Checkbox.prompt({
        message: "Select workspaces to enable:",
        search: true,
        options,
    });
}

const result = await Result.wrap(() => promptForWorkspaceSelection(options), handleError)();

// ❌ WRONG - Complex inline callback
const result = await Result.wrap(() => Checkbox.prompt({
    message: "Select workspaces to enable:",
    search: true,
    options,
}), handleError)();
```

### 4.3 Meaningful Extraction Guidelines

```typescript
// ✅ CORRECT - Extracted helper with meaningful logic
async function syncSingleWorkspace(workspace: WorkspaceConfigItem, root: string): Promise<Result<void, Error>> {
    const fullPath = join(root, workspace.path);
    const git = new GitManager(fullPath);

    const statusResult = await git.status();
    if (!statusResult.ok) {
        return Result.error(statusResult.error);
    }

    if (statusResult.value.isDirty) {
        return handleDirtyWorkspace(git, workspace);
    }

    return git.pull();
}

// ❌ WRONG - Unnecessary wrapper (too thin)
async function pullWorkspace(git: GitManager): Promise<Result<void, Error>> {
    return git.pull(); // Just wraps a single call - unnecessary abstraction
}

// ❌ WRONG - Over-abstraction
function logSuccess(message: string): void {
    console.log(green(message)); // Single line wrapped - not needed
}
```

## 5. Type Safety - No `any` Types

Avoid using `any` type. Always use proper TypeScript types. Import types from their source files.

```typescript
// ✅ CORRECT
import { type WorkspaceConfigItem } from "../types/config.ts";
import { type HookExecutionResult } from "../libs/hooks.ts";

function processWorkspace(workspace: WorkspaceConfigItem): void { }
function processHook(result: HookExecutionResult): void { }

// ❌ WRONG
function processWorkspace(workspace: any): void { }
function processHook(result: any): void { }
```

## 6. Remove Unused Parameters

Remove any unused parameters from function signatures to keep the API clean.

```typescript
// ✅ CORRECT - Only necessary parameters
async function handleDirtyWorkspace(git: GitManager, workspace: WorkspaceConfigItem): Promise<Result<void, Error>> { }

// ❌ WRONG - Unused workspacePath parameter
async function handleDirtyWorkspace(git: GitManager, workspace: WorkspaceConfigItem, workspacePath: string): Promise<Result<void, Error>> { }
```

## 7. Function Signature Formatting

Keep function signatures on a single line when possible. Let the IDE formatter handle line breaks for long signatures.

```typescript
// ✅ CORRECT - Single line, let IDE handle
async function syncSingleWorkspace(workspace: WorkspaceConfigItem, workspaceRoot: string, manager: WorkspaceManager): Promise<Result<void, Error>> { }

// ❌ WRONG - Manual multi-line splitting
async function syncSingleWorkspace(
    workspace: WorkspaceConfigItem,
    workspaceRoot: string,
    manager: WorkspaceManager,
): Promise<Result<void, Error>> { }
```

## Summary

| Rule | Description |
|------|-------------|
| Curly Braces | All `if`, `for`, `while` statements must have curly braces |
| Single-Line | Keep non-control-flow statements on one logical line |
| Object Parameters | 3+ properties → multi-line; 1-2 properties → inline |
| Early-Return | Use in dedicated functions, not carelessly in main flow |
| Function Extraction | Extract meaningful logic, avoid thin wrappers, inline arrows with control flow; extract complex callbacks |
| Type Safety | No `any` types - use proper TypeScript types |
| Clean Parameters | Remove unused parameters from function signatures |
| IDE Formatting | Let the IDE handle line breaks and width-based formatting |
