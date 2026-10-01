# Debugging & Testing Guide

_A practical guide for debugging complex issues and running tests effectively, learned from investigating production regressions in large codebases._

## Quick Start Debugging Checklist

When you encounter a bug report or failing test:

1. **Reproduce first** - Create a minimal test case that demonstrates the exact issue
2. **Establish baseline** - Run existing tests to see what currently works/breaks
3. **Add targeted logging** - Insert debug output at key decision points
4. **Trace the data flow** - Follow the path from input to unexpected output
5. **Check recent changes** - Look for version changes mentioned in bug reports
6. **Test your hypothesis** - Make small, targeted changes and validate each step

## Essential Testing Commands

### Monorepo with Nx

```bash
# Run all tests for a package
npx nx test:unit @package-name

# Run specific test file
npx nx test:unit @package-name -- --run path/to/test.test.tsx

# Run tests matching a pattern
npx nx test:unit @package-name -- --run "pattern-in-test-name"

# Run with verbose output
npx nx test:unit @package-name -- --run --verbose
```

### Standard npm/yarn projects

```bash
# Run specific test file
npm test -- --run path/to/test.test.tsx
yarn test path/to/test.test.tsx

# Run tests matching pattern
npm test -- --grep "test pattern"
```

### Useful test flags

```bash
# Run only (don't watch for changes)
--run

# Show full output including console.logs
--verbose

# Run in specific environment
--environment=jsdom
```

## Effective Debugging Strategies

### 1. Strategic Logging

```javascript
// Use distinctive prefixes for easy filtering
console.log('[DEBUG useNavigate] from:', from, 'to:', to)
console.log('[DEBUG router] current location:', state.location.pathname)

// Log both input and output of functions
console.log('[DEBUG buildLocation] input:', dest)
// ... function logic ...
console.log('[DEBUG buildLocation] output:', result)
```

**Pro tip:** Use `[DEBUG componentName]` prefixes so you can easily filter logs in browser dev tools.

### 2. Reproduction Test Pattern

```javascript
test('should reproduce the exact issue from bug report', async () => {
  // Set up the exact scenario described
  const router = createRouter({
    /* exact config from bug report */
  })

  // Perform the exact user actions
  await navigate({ to: '/initial-route' })
  await navigate({ to: '.', search: { param: 'value' } })

  // Assert the expected vs actual behavior
  expect(router.state.location.pathname).toBe('/expected')
  // This should fail initially, proving reproduction
})
```

### 3. Data Flow Tracing

```
User Action → Hook Call → Router Logic → State Update → UI Update
     ↓            ↓           ↓           ↓          ↓
  onClick()  → useNavigate() → buildLocation() → setState() → re-render
```

Add logging at each step to see where the flow diverges from expectations.

## Common Pitfalls & Solutions

### React Testing Issues

**Problem:** State updates not reflected in tests

```javascript
// ❌ Bad - missing act() wrapper
fireEvent.click(button)
expect(component.state).toBe(newValue)

// ✅ Good - wrapped in act()
act(() => {
  fireEvent.click(button)
})
expect(component.state).toBe(newValue)
```

**Problem:** Async operations not completing

```javascript
// ❌ Bad - not waiting for async
const result = await someAsyncOperation()
expect(result).toBe(expected)

// ✅ Good - ensuring completion
await act(async () => {
  await someAsyncOperation()
})
expect(result).toBe(expected)
```

### React Router Specific Issues

**Context vs Location confusion:**

- `useMatch({ strict: false })` returns the **component's route context**
- `router.state.location.pathname` returns the **current URL**
- These can be different when components are rendered by parent routes

```javascript
// Component rendered by parent route "/" but URL is "/child"
const match = useMatch({ strict: false }) // Returns "/" context
const location = router.state.location.pathname // Returns "/child"
```

## Search & Investigation Commands

### Finding relevant code

```bash
# Search for specific patterns in TypeScript/JavaScript files
grep -r "navigate.*to.*\." --include="*.ts" --include="*.tsx" .

# Find files related to a feature
find . -name "*navigate*" -type f

# Search with ripgrep (faster)
rg "useNavigate" --type typescript
```

### Git investigation

```bash
# Find when a specific line was changed
git blame path/to/file.ts

# See recent changes to a file
git log --oneline -10 path/to/file.ts

# Search commit messages
git log --grep="navigation" --oneline
```

## Testing Best Practices

### Test Structure

```javascript
describe('Feature', () => {
  beforeEach(() => {
    // Reset state for each test
    cleanup()
    history = createBrowserHistory()
  })

  test('should handle specific scenario', async () => {
    // Arrange - set up the test conditions
    const router = createRouter(config)

    // Act - perform the action being tested
    await act(async () => {
      navigate({ to: '/target' })
    })

    // Assert - verify the results
    expect(router.state.location.pathname).toBe('/target')
  })
})
```

### Multiple Assertions

```javascript
test('navigation should update both path and search', async () => {
  await navigate({ to: '/page', search: { q: 'test' } })

  // Test multiple aspects
  expect(router.state.location.pathname).toBe('/page')
  expect(router.state.location.search).toEqual({ q: 'test' })
  expect(router.state.matches).toHaveLength(2)
})
```

## Architecture Investigation Process

### 1. Map the System

```
User Input → Component → Hook → Core Logic → State → UI
```

Identify each layer and what it's responsible for.

### 2. Find the Divergence Point

Use logging to identify exactly where expected behavior diverges:

```javascript
console.log('Input received:', input)
// ... processing ...
console.log('After step 1:', intermediate)
// ... more processing ...
console.log('Final output:', output) // Is this what we expected?
```

### 3. Check Assumptions

Common false assumptions:

- "This hook returns the current route" (might return component context)
- "State updates are synchronous" (often async in React)
- "This worked before" (check if tests actually covered this case)

## Regression Investigation

### Version Comparison

```bash
# Check what changed between versions
git diff v1.120.13..v1.121.34 -- packages/react-router/

# Look for specific changes
git log v1.120.13..v1.121.34 --oneline --grep="navigate"
```

### Bisecting Issues

```bash
# Start bisect to find breaking commit
git bisect start
git bisect bad HEAD
git bisect good v1.120.13

# Test each commit until you find the breaking change
```

## When to Stop & Reconsider

**Stop changing code when:**

- Your fix breaks multiple existing tests
- You're changing fundamental assumptions
- The solution feels hacky or overly complex

**Consider instead:**

- Adding a new API rather than changing existing behavior
- Documenting the current behavior if it's actually correct
- Creating a more targeted fix for the specific use case

## Advanced Debugging Techniques

### React DevTools

- Inspect component tree to understand render context
- Check props and state at each level
- Use Profiler to identify performance issues

### Browser DevTools

```javascript
// Add global debugging helpers
window.debugRouter = router
window.debugState = () => console.log(router.state)

// Use conditional breakpoints
if (router.state.location.pathname === '/problematic-route') {
  debugger
}
```

### Test Isolation

```javascript
// Run only one test to isolate issues
test.only('this specific failing test', () => {
  // ...
})

// Skip problematic tests temporarily
test.skip('temporarily disabled', () => {
  // ...
})
```

## Key Takeaways

1. **Reproduction beats theory** - A failing test that demonstrates the issue is worth more than understanding the problem in theory

2. **Existing tests are protection** - If your fix breaks many existing tests, you're probably changing the wrong thing

3. **Context matters** - Especially in React, understanding where components are rendered and what context they have access to is crucial

4. **Small changes, frequent validation** - Make small, targeted changes and test each one rather than large refactors

5. **Sometimes the answer is "don't change it"** - Not every reported issue needs a code change; sometimes documentation or a new API is the right solution

---

_This guide was developed while investigating a navigation regression in TanStack Router, where `navigate({ to: "." })` unexpectedly redirected to the root instead of staying on the current route._
