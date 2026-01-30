# TypeScript Result Pattern Guide

## Overview

This guide documents the strict requirements for using `npm:typescript-result` for all error handling in this codebase. **NO TRY-CATCH BLOCKS ARE ALLOWED ANYWHERE**.

## Core Functions

### Result.wrap()
Convert functions that throw errors to return Result types:
```typescript
import { Result } from "typescript-result";

// Wrap functions that might throw
const readFile = Result.wrap(Deno.readTextFile);
const fetch = Result.wrap(globalThis.fetch);
const writeTextFile = Result.wrap(Deno.writeTextFile);
const mkdirSync = Result.wrap(Deno.mkdirSync);
```

### Result.ok() and Result.error()
Create Result types explicitly:
```typescript
// Success case
return Result.ok(value);

// Error case
return Result.error(new Error("Descriptive error message"));
```

## Basic Usage Pattern

```typescript
import { Result } from "typescript-result";

async function getData(): Promise<Result<string, Error>> {
  // Wrap functions that might throw
  const result = await readFile("file.txt");

  // Check if successful
  if (!result.ok) {
    // Return error Result
    return Result.error(new Error(`Failed to read file: ${result.error.message}`));
  }

  // Return success Result
  return Result.ok(result.value);
}

// Handle Results
const dataResult = await getData();
if (dataResult.ok) {
  console.log(dataResult.value); // Use the successful value
} else {
  console.error(dataResult.error.message); // Handle the error
}
```

## HTTP Client Example

```typescript
// Wrap async operations
const fetch = Result.wrap(globalThis.fetch);
const writeTextFile = Result.wrap(Deno.writeTextFile);

async fetchWithCache(url: string): Promise<Result<string, Error>> {
  // Try cache first
  const cachedResult = await this.readFromCache(url);
  if (cachedResult.ok) {
    return cachedResult; // Return cached content
  }

  // Fetch from network
  const fetchResult = await fetch(url);
  if (!fetchResult.ok) {
    return fetchResult; // Return fetch error
  }

  // Save to cache
  const saveResult = await this.saveToCache(url, fetchResult.value);
  if (!saveResult.ok) {
    console.warn(`Failed to save cache: ${saveResult.error.message}`);
  }

  return fetchResult; // Return fetched content
}
```

## Synchronous Operations

```typescript
const mkdirSync = Result.wrap(Deno.mkdirSync);

private ensureCacheDir(): Result<void, Error> {
  return mkdirSync(this.cacheDir, { recursive: true });
}
```

## Async Operations Pattern

```typescript
// All async functions should return Promise<Result<T, Error>>
async processData(): Promise<Result<ProcessedData, Error>> {
  // Chain Result operations using async/await
  const step1 = await this.step1();
  if (!step1.ok) return step1;

  const step2 = await this.step2(step1.value);
  if (!step2.ok) return step2;

  return Result.ok(step2.value);
}
```

## Function Wrapping Guidelines

### Common Candidates to Wrap:
- `Deno.readTextFile` / `Deno.readTextFileSync`
- `Deno.writeTextFile` / `Deno.writeTextFileSync`
- `globalThis.fetch`
- `Deno.mkdirSync` / `Deno.mkdir`
- Any function that might throw

### Always Wrap:
- Both sync and async functions that can fail
- File system operations
- HTTP requests
- Database operations

## Result Handling Pattern

### Check `.ok` First:
```typescript
if (result.ok) {
  // Use result.value safely
  return result.value;
} else {
  // Handle result.error
  throw new Error(result.error.message);
}
```

### Never Assume Success:
```typescript
// WRONG - Never do this
const data = result.value; // Might be undefined

// RIGHT - Always check first
if (result.ok) {
  const data = result.value; // Safe to use
}
```

## Error Creation Guidelines

### Success Results:
```typescript
Result.ok(value) // For successful operations
```

### Error Results:
```typescript
Result.error(new Error("Descriptive error message"))
```

### Error Message Requirements:
- Provide descriptive error messages that include context
- Preserve original error information when possible
- Include relevant parameters or state that caused the error

## Caching with Results

### Cache Strategy:
```typescript
async fetchWithCache(url: string): Promise<Result<string, Error>> {
  // Return cached content if available and valid
  const cachedResult = await this.readFromCache(url);
  if (cachedResult.ok) {
    return cachedResult;
  }

  // Fetch from network when cache miss occurs
  const fetchResult = await fetch(url);
  if (!fetchResult.ok) {
    return fetchResult;
  }

  // Store successful fetches in cache
  const saveResult = await this.saveToCache(url, fetchResult.value);
  if (!saveResult.ok) {
    console.warn(`Failed to save cache: ${saveResult.error.message}`);
  }

  return fetchResult;
}
```

## Error Propagation

### Propagate Errors Up:
```typescript
async parentFunction(): Promise<Result<T, Error>> {
  const childResult = await this.childFunction();
  if (!childResult.ok) {
    return childResult; // Propagate error up the call stack
  }

  // Continue with successful value
  return Result.ok(processData(childResult.value));
}
```

### Don't Handle Immediately:
- Propagate errors up the call stack rather than handling immediately
- Only handle errors at the appropriate level (usually CLI command handlers)

## Testing with Results

### Test Success Paths:
```typescript
Deno.test("should return success result", async () => {
  const result = await functionUnderTest();
  assert(result.ok);
  assertEquals(result.value, expectedValue);
});
```

### Test Error Paths:
```typescript
Deno.test("should return error result", async () => {
  const result = await functionThatFails();
  assert(!result.ok);
  assertEquals(result.error.message, expectedErrorMessage);
});
```

## Common Patterns

### Database Operations:
```typescript
async queryUser(id: string): Promise<Result<User, Error>> {
  const dbResult = await this.db.query(`SELECT * FROM users WHERE id = ?`, [id]);
  if (!dbResult.ok) {
    return Result.error(new Error(`Database query failed: ${dbResult.error.message}`));
  }

  if (dbResult.value.length === 0) {
    return Result.error(new Error("User not found"));
  }

  return Result.ok(dbResult.value[0]);
}
```

### File Operations:
```typescript
async saveData(data: Data): Promise<Result<void, Error>> {
  const dirResult = await this.ensureDirExists();
  if (!dirResult.ok) {
    return dirResult;
  }

  const saveResult = await this.writeTextFile(this.filePath, JSON.stringify(data));
  if (!saveResult.ok) {
    return Result.error(new Error(`Failed to save data: ${saveResult.error.message}`));
  }

  return Result.ok(undefined);
}
```

## Migration from Try-Catch

### Before (Forbidden):
```typescript
// NEVER DO THIS
try {
  const data = await Deno.readTextFile("file.txt");
  return data;
} catch (error) {
  throw new Error(`Failed to read file: ${error.message}`);
}
```

### After (Required):
```typescript
// ALWAYS DO THIS
const readFile = Result.wrap(Deno.readTextFile);
const result = await readFile("file.txt");
if (!result.ok) {
  return Result.error(new Error(`Failed to read file: ${result.error.message}`));
}
return Result.ok(result.value);
```
