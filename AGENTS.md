# Workspace Manager - Technical Constraints

## Technology Stack

- **Runtime**: Deno 2.4+ with TypeScript
- **CLI Framework**: Cliffy - https://cliffy.io
- **Error Handling**: typescript-result library - https://www.typescript-result.dev
- **Configuration**: YAML parsing via @std/yaml
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

## Project Structure & Organization

```
/home/ball6847/Projects/personal/workspace-manager/
├── main.ts                    # CLI entry point (minimal - delegates to src/cli.ts)
├── src/
│   ├── cli.ts                 # CLI command definitions and configuration
│   ├── cmds/                  # CLI command implementations (one per file)
│   │   ├── add.ts            # Add new repositories to workspace
│   │   ├── enable.ts         # Enable disabled workspace repositories
│   │   ├── open.ts           # Open workspace in editor via interactive selection
│   │   ├── save.ts           # Save current workspace state to config
│   │   ├── status.ts         # Show workspace status with branch/dirty tracking
│   │   ├── sync.ts           # Sync workspace with remote repositories
│   │   └── update.ts         # Update submodules to latest branches
│   └── libs/                 # Reusable utility libraries
│       ├── command-error-handler.ts  # CLI error handling abstraction
│       ├── concurrent.ts     # Concurrent processing with batching
│       ├── errors.ts         # Custom error types and wrappers
│       ├── file.ts           # File system utilities and validation
│       ├── git.ts            # Git operations (submodules, branches, status)
│       ├── go.ts             # Go workspace management (go.work integration)
│       └── workspace-discovery.ts  # Auto-discovery of workspace config
├── build/                     # Compiled output directory
│   └── cli.js                # Bundled CLI executable
├── example/                   # Example configuration files
│   └── workspace.yml         # Sample workspace configuration
├── deno.json                  # Deno project configuration and tasks
├── deno.lock                  # Dependency lock file
└── .vscode/settings.json      # VSCode Deno integration settings
```

## Configuration

### Workspace Configuration (`workspace.yml`)
```yaml
# Global editor setting (used by 'open' command)
editor: "nvim"

workspaces:
  - url: 'git@github.com:user/repo.git'
    path: services/my-service
    branch: main
    isGolang: true      # Include in go.work file
    active: true        # Include in sync operations
```

### Deno Configuration (`deno.json`)
- **Imports**: JSR packages (@cliffy, @std) + npm packages (typescript-result, zod - imported but not used)
- **Formatter**: 4-space tabs, 200 width, double quotes
- **Linter**: Recommended rules only

## Error Handling Strategy

The project uses functional error handling with `typescript-result` instead of try-catch blocks:

```typescript
import { Result } from "typescript-result";

// Wrap operations that might fail
const result = await Result.fromAsyncCatching(() => riskyOperation());

// Chain operations with error propagation
const finalResult = result
    .map(data => transformData(data))
    .mapError(error => new ErrorWithCause("Operation failed", error));

// Handle results
if (!finalResult.ok) {
    console.error("Error:", finalResult.error.message);
    Deno.exit(1);
}
```

### Error Types
- **ErrorWithCause**: Base error class with cause chaining for debugging
- **wrapError(context, cause)**: One-liner helper to create ErrorWithCause
- **wrapErrorResult(context, cause)**: One-liner for Result.error with ErrorWithCause

### Error Handler Abstraction
The `command-error-handler.ts` module provides error handling abstraction:
- **ErrorHandler**: Interface for custom error handlers
- **ConsoleErrorHandler**: Default handler that prints to console
- **CommandErrorHandler**: Wrapper that processes Result types
- **CommandErrorHandler.withExit()**: Static method that exits on error

```typescript
import { CommandErrorHandler, ConsoleErrorHandler } from "./libs/command-error-handler.ts";

// In CLI action:
const result = await someCommand(options);
CommandErrorHandler.withExit(result, "CommandName");
```

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

## Workspace Discovery Constraint

The `workspace-discovery.ts` module provides intelligent config file discovery:

```typescript
import { WorkspaceDiscovery } from "./libs/workspace-discovery.ts";

// Option 1: Auto-discover by searching cwd and parent directories
const discovery = new WorkspaceDiscovery();
const result = await discovery.discover();

// Option 2: Provide explicit config
const discovery = new WorkspaceDiscovery({ config: "custom.yml" });
const result = await discovery.discover();

// Option 3: Provide explicit workspace root
const discovery = new WorkspaceDiscovery({ workspaceRoot: "/path/to/workspace" });
const result = await discovery.discover();
```

**Resolution Order:**
1. If both config and workspaceRoot provided → use them directly
2. If only config provided → use it, derive workspaceRoot from its directory
3. If only workspaceRoot provided → look for config file there
4. If neither provided → discover workspace.yml in current and parent directories

## Deno Permission Requirements

The CLI requires the following Deno permissions:
- `--allow-run`: Execute Git and Go commands
- `--allow-write`: Create/modify files and directories
- `--allow-read`: Read configuration and workspace files
- `--allow-env`: Access environment variables
- `--allow-net`: Network access for Git operations

## Development Workflow

### Adding New Commands
1. Create new file in `cmds/` directory
2. Define command options type
3. Implement command function returning `Result<void, Error>`
4. **Use early-return pattern** - Handle validation and error cases first
5. Add command to `src/cli.ts` with proper error handling
6. Update README.md with command documentation

### Adding New Libraries
1. Create file in `libs/` directory
2. Export functions returning `Result` types
3. Use `ErrorWithCause` for error wrapping
4. **Apply early-return pattern** - Check error conditions and return early
5. Follow functional programming patterns

### Workspace Discovery Integration
When adding new commands, use `WorkspaceDiscovery` for config/workspaceRoot handling:

```typescript
import { WorkspaceDiscovery } from "../libs/workspace-discovery.ts";

async function myCommand(options: MyOptions): Result<void, Error> {
    const discovery = new WorkspaceDiscovery({
        config: options.config,
        workspaceRoot: options.workspaceRoot,
    });

    const discoverResult = await discovery.discover();
    if (!discoverResult.ok) {
        return Result.error(discoverResult.error);
    }

    const { workspaceRoot, configPath } = discoverResult.value;
    // Proceed with operations...
}
```

## Dependency Constraints

### JSR Packages (Preferred)
- `@cliffy/*`: CLI framework components (command, prompt, table, ansi, keycode, internal)
- `@std/*`: Standard library modules (yaml, path, fmt, text, dotenv)

### NPM Packages (When JSR unavailable)
- `typescript-result`: Functional error handling (MANDATORY - no try-catch blocks allowed)
- `zod`: Import available but not currently used
