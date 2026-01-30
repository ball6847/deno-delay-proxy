# Workspace Manager - Technical Constraints

## Technology Stack

- **Runtime**: Deno 2.4+ with TypeScript
- **Error Handling**: typescript-result library - https://www.typescript-result.dev
- **Package Management**: JSR (JavaScript Registry) and npm hybrid approach

## Architecture & Design Principles

### SOLID Principles
The codebase strictly follows SOLID principles with clean separation of concerns:
- Single Responsibility: Each module has one clear purpose
- Open/Closed: Extensible through configuration and interfaces
- Dependency Inversion: High-level modules don't depend on low-level details

### Code Style Guidelines
- Use `type` instead of `interface` for type definitions
- Use async-await for all asynchronous operations
- **Use early-return pattern for control flow** - Handle error/edge cases first, then return early
- **Use early-continue in loops** - Skip to next iteration immediately when conditions aren't met
- Use `type` keyword when importing types from other files
- 4-space indentation with tabs
- 200 character line width (from deno.json)
- Double quotes for strings
- **Format on save enabled in VSCode

### Deno Configuration (`deno.json`)
- **Imports**: JSR packages (@cliffy, @std) + npm packages (typescript-result, zod - imported but not used)
- **Formatter**: 4-space tabs, 200 width, double quotes
- **Linter**: Recommended rules only

### Early-Return Pattern Examples

```typescript
// ✅ GOOD: Early-return pattern
function processValue(value: string | null): string {
    if (!value) {
        return "default";
    }

    if (value.length === 0) {
        return "empty";
    }

    // Main logic after all edge cases handled
    return value.toUpperCase();
}

// ✅ GOOD: Early-continue in loops
function processItems(items: Item[]): ProcessedItem[] {
    const results: ProcessedItem[] = [];

    for (const item of items) {
        if (!item.isValid) {
            continue; // Skip invalid items immediately
        }

        if (item.isProcessed) {
            continue; // Skip already processed items
        }

        // Process valid, unprocessed items
        results.push(processItem(item));
    }

    return results;
}

// ❌ AVOID: Deep nesting
function processValueBad(value: string | null): string {
    if (value) {
        if (value.length > 0) {
            // Main logic buried deep in nesting
            return value.toUpperCase();
        } else {
            return "empty";
        }
    } else {
        return "default";
    }
}
```

## Deno Permission Requirements

The CLI requires the following Deno permissions:
- `--allow-run`: Execute Git and Go commands
- `--allow-write`: Create/modify files and directories
- `--allow-read`: Read configuration and workspace files
- `--allow-env`: Access environment variables
- `--allow-net`: Network access for Git operations
