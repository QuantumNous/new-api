# ESLint Plugin Performance Improvements Plan

## Problem Statement

The `no-async-client-component` rule currently builds a **full render graph** of the entire TypeScript program on every lint run. This involves:

1. Iterating through ALL source files in the program
2. Indexing ALL component definitions
3. Building ALL render edges (JSX references)
4. Only then checking a small subset for violations

For a codebase with **thousands of files** and **only a few route files**, this is extremely wasteful:

```
Current:  Scan 5000 files → Build graph of ~2000 components → Use ~50 of them
Optimal:  Find 10 route files → Analyze only ~50 referenced components
```

## Solution: Lazy Entry-Point Analysis

Instead of building a complete program graph upfront, we analyze **on-demand** starting from entry points:

1. When linting file X, quick check: Does X have `createServerComponent` or route options?
2. If no: Skip entirely (zero analysis cost)
3. If yes: Analyze only components reachable from X's entry points

This mirrors how `no-client-code-in-server-component` already works with its on-demand `CallExpression` trigger + `transitive-analyzer.ts` reachability walk.

---

## Implementation Phases

### Phase 1: Extract Shared Utilities (Safe, Low-Risk)

**Goal:** Create shared infrastructure that both rules can use.

#### 1.1 Create shared folder structure

```
packages/eslint-plugin-start/src/
├── rules/
│   ├── no-async-client-component/
│   └── no-client-code-in-server-component/
└── shared/                          # NEW
    ├── use-client-resolver.ts       # Moved from no-client-code-in-server-component
    ├── component-resolver.ts        # NEW: Resolve component symbols
    ├── transitive-walker.ts         # NEW: Unified transitive analysis
    └── types.ts                     # NEW: Shared type definitions
```

#### 1.2 Extract use-client-resolver

Move `rules/no-client-code-in-server-component/use-client-resolver.ts` to `shared/use-client-resolver.ts`.

No logic changes needed - just re-export from both rules.

```typescript
// shared/use-client-resolver.ts
export interface UseClientResolver {
  hasUseClientDirective(fileName: string): boolean
}

export function createUseClientResolver(
  program: ts.Program,
): UseClientResolver {
  const cache = new Map<string, boolean>()

  return {
    hasUseClientDirective(fileName: string): boolean {
      if (cache.has(fileName)) return cache.get(fileName)!

      const sourceFile = program.getSourceFile(fileName)
      if (!sourceFile) {
        cache.set(fileName, false)
        return false
      }

      const result = checkFirstStatement(sourceFile)
      cache.set(fileName, result)
      return result
    },
  }
}
```

#### 1.3 Create component-resolver

New utility to resolve component symbols from various patterns:

```typescript
// shared/component-resolver.ts
export interface ComponentInfo {
  name: string
  fileName: string
  symbol: ts.Symbol
  declaration: ts.Declaration
  isAsync: boolean
}

export interface ComponentResolver {
  /**
   * Resolve a component from an identifier (e.g., JSX tag name or route option value)
   */
  resolveComponent(node: ts.Identifier): ComponentInfo | undefined

  /**
   * Check if a function-like node is async
   */
  isAsyncFunction(node: ts.Node): boolean
}

export function createComponentResolver(
  ts: typeof import('typescript'),
  checker: ts.TypeChecker,
): ComponentResolver {
  // Implementation...
}
```

#### 1.4 Create shared types

```typescript
// shared/types.ts
export interface EntryPoint {
  type: 'server-component' | 'route-option'
  node: ts.Node
  fileName: string
  /** For route-option, the specific option name (component, pendingComponent, etc.) */
  optionName?: string
}

export interface AnalysisContext {
  program: ts.Program
  checker: ts.TypeChecker
  useClientResolver: UseClientResolver
  componentResolver: ComponentResolver
}
```

---

### Phase 2: Refactor no-async-client-component to On-Demand

**Goal:** Avoid full-program graph build; analyze only when a file contains route options / entry points.

#### 2.1 New architecture

```
Before:
┌─────────────────────────────────────────────────────────────┐
│ Program() visitor                                           │
│   └── For each file in program:                             │
│         └── Index all components, edges, roots              │
│   └── analyzeContext() on complete graph                    │
│   └── Report violations                                     │
└─────────────────────────────────────────────────────────────┘

After:
┌─────────────────────────────────────────────────────────────┐
│ CallExpression visitor (only triggers on specific calls)    │
│   └── Is this createFileRoute/createRootRoute/etc?          │
│         └── YES: Extract component references from options  │
│                  └── For each component: analyzeTransitively│
│   └── Is this createServerComponent?                        │
│         └── YES: Mark referenced components as server context│
└─────────────────────────────────────────────────────────────┘
```

#### 2.2 Stop building full-program render graph

Replace full-program graph build with per-entry-point analysis. Actual file deletion can come later after parity is proven.

#### 2.3 Stop precomputing global context

Context propagation becomes implicit in a focused traversal (starting from route-option components and respecting server boundaries).

#### 2.4 New rule structure

```typescript
// no-async-client-component.rule.ts (simplified)
export const rule = ESLintUtils.RuleCreator(getDocsUrl)({
  // ...meta...

  create(context) {
    const services = ESLintUtils.getParserServices(context)
    const program = services.program
    const checker = program.getTypeChecker()

    // Shared utilities
    const useClientResolver = createUseClientResolver(program)
    const componentResolver = createComponentResolver(ts, checker)

    // Track what we've already analyzed to avoid duplicates
    const analyzedComponents = new Set<string>()
    const reportedViolations = new Set<string>()

    return {
      CallExpression(node) {
        const tsNode = services.esTreeNodeToTSNodeMap.get(node)

        // Check for route options: createFileRoute('/')({ component: X })
        const routeComponents = extractRouteOptionComponents(tsNode)
        if (routeComponents.length > 0) {
          for (const { component, optionNode } of routeComponents) {
            analyzeAsClientRoot(component, optionNode, node)
          }
          return
        }

        // Check for server component: createServerComponent(() => <X />)
        const serverComponents = extractServerComponentChildren(tsNode)
        if (serverComponents.length > 0) {
          // These are in server context - async is ALLOWED here
          // Mark them so we don't report if encountered via route options
          for (const comp of serverComponents) {
            markAsServerContext(comp)
          }
        }
      },
    }

    function analyzeAsClientRoot(
      componentSymbol: ts.Symbol,
      usageNode: ts.Node,
      eslintNode: TSESTree.CallExpression,
    ) {
      // Walk transitively, checking for async components
      // Stop at 'use client' boundaries
      // Report violations at usageNode location
    }
  },
})
```

#### 2.5 Transitive async analysis

```typescript
interface AsyncAnalysisResult {
  /** Components that are async and in client context */
  asyncViolations: Array<{
    componentName: string
    componentFile: string
    isAsync: boolean
    chain: Array<{ file: string; component: string }>
  }>
  /** Whether we hit a 'use client' boundary (stops propagation) */
  hitClientBoundary: boolean
}

function analyzeComponentTransitively(
  entrySymbol: ts.Symbol,
  context: AnalysisContext,
  visited: Set<string>,
): AsyncAnalysisResult {
  const key = symbolKey(entrySymbol)
  if (visited.has(key)) return { asyncViolations: [], hitClientBoundary: false }
  visited.add(key)

  const decl = entrySymbol.getDeclarations()?.[0]
  if (!decl) return { asyncViolations: [], hitClientBoundary: false }

  const fileName = decl.getSourceFile().fileName

  // Check for 'use client' boundary
  if (context.useClientResolver.hasUseClientDirective(fileName)) {
    return { asyncViolations: [], hitClientBoundary: true }
  }

  const violations: AsyncAnalysisResult['asyncViolations'] = []

  // Check if this component is async
  const componentInfo = context.componentResolver.resolveFromDeclaration(decl)
  if (componentInfo?.isAsync) {
    violations.push({
      componentName: componentInfo.name,
      componentFile: fileName,
      isAsync: true,
      chain: [],
    })
  }

  // Find JSX children and recurse
  const childRefs = findJsxComponentReferences(decl)
  for (const childRef of childRefs) {
    const childSymbol = context.checker.getSymbolAtLocation(childRef)
    if (!childSymbol) continue

    const childResult = analyzeComponentTransitively(
      resolveAlias(childSymbol),
      context,
      visited,
    )

    if (childResult.hitClientBoundary) continue // Stop at boundary

    // Add chain info to child violations
    for (const v of childResult.asyncViolations) {
      violations.push({
        ...v,
        chain: [
          { file: fileName, component: componentInfo?.name ?? 'unknown' },
          ...v.chain,
        ],
      })
    }
  }

  return { asyncViolations: violations, hitClientBoundary: false }
}
```

---

### Phase 3: Unify Transitive Analysis

**Goal:** Both rules share the same transitive walking infrastructure.

#### 3.1 Create unified transitive-walker

```typescript
// shared/transitive-walker.ts

export interface WalkOptions {
  /** Whether to detect client-only code violations (hooks, onClick, etc.) */
  detectClientViolations?: boolean
  /** Whether to detect async component violations */
  detectAsyncViolations?: boolean
  /** Allowed hooks for client violation detection */
  allowedHooks?: Set<string>
}

export interface WalkResult {
  /** Client-only code violations (if detectClientViolations) */
  clientViolations: Array<ClientViolation>
  /** Async components found (if detectAsyncViolations) */
  asyncComponents: Array<AsyncComponentInfo>
  /** Whether a 'use client' boundary was hit */
  hitClientBoundary: boolean
  /** Import chain to reach this point */
  chain: Array<ImportEdge>
}

export interface TransitiveWalker {
  /**
   * Walk from an entry symbol, collecting violations based on options.
   * Stops at 'use client' boundaries.
   */
  walk(entrySymbol: ts.Symbol, options: WalkOptions): WalkResult

  /**
   * Clear caches (call between unrelated analyses)
   */
  clearCaches(): void
}

export function createTransitiveWalker(
  ts: typeof import('typescript'),
  context: AnalysisContext,
): TransitiveWalker {
  // Per-symbol cache for walk results
  const walkCache = new Map<string, WalkResult>()

  // Per-file violation cache (reusable across symbols in same file)
  const fileViolationCache = new Map<string, Array<ClientViolation>>()

  return {
    walk(entrySymbol, options) {
      const cacheKey = `${symbolKey(entrySymbol)}:${JSON.stringify(options)}`
      if (walkCache.has(cacheKey)) return walkCache.get(cacheKey)!

      const result = walkInternal(entrySymbol, options, new Set(), [])
      walkCache.set(cacheKey, result)
      return result
    },

    clearCaches() {
      walkCache.clear()
      fileViolationCache.clear()
    },
  }

  function walkInternal(
    symbol: ts.Symbol,
    options: WalkOptions,
    visited: Set<string>,
    chain: Array<ImportEdge>,
  ): WalkResult {
    // Implementation combines logic from:
    // - transitive-analyzer.ts (following symbols)
    // - violation-detector.ts (detecting client violations)
    // - render-graph-builder.ts (detecting async)
  }
}
```

#### 3.2 Update no-client-code-in-server-component to use shared walker

```typescript
// no-client-code-in-server-component.rule.ts
import { createTransitiveWalker } from '../../shared/transitive-walker'

export const rule = ESLintUtils.RuleCreator(getDocsUrl)({
  create(context) {
    const walker = createTransitiveWalker(ts, analysisContext)

    return {
      CallExpression(node) {
        if (!isCreateServerComponentCall(node)) return

        const componentRefs = findComponentReferences(callback)
        for (const ref of componentRefs) {
          const result = walker.walk(resolvedSymbol, {
            detectClientViolations: true,
            detectAsyncViolations: false, // Other rule handles this
            allowedHooks,
          })

          if (result.hitClientBoundary) continue

          for (const violation of result.clientViolations) {
            reportViolation(violation, result.chain, ref.text, eslintNode)
          }
        }
      },
    }
  },
})
```

#### 3.3 Update no-async-client-component to use shared walker

```typescript
// no-async-client-component.rule.ts
import { createTransitiveWalker } from '../../shared/transitive-walker'

export const rule = ESLintUtils.RuleCreator(getDocsUrl)({
  create(context) {
    const walker = createTransitiveWalker(ts, analysisContext)

    return {
      CallExpression(node) {
        const routeComponents = extractRouteOptionComponents(tsNode)

        for (const { componentSymbol, optionNode } of routeComponents) {
          const result = walker.walk(componentSymbol, {
            detectClientViolations: false, // Other rule handles this
            detectAsyncViolations: true,
          })

          if (result.hitClientBoundary) continue

          for (const asyncComp of result.asyncComponents) {
            reportAsyncViolation(asyncComp, optionNode, eslintNode)
          }
        }
      },
    }
  },
})
```

---

### Phase 4: Enhanced Caching (Future)

**Goal:** Further optimize repeat analyses with persistent caches.

> **Note:** This phase is documented for future implementation. Do not implement yet.

#### 4.1 File-level violation cache

Cache violations detected in each source file, keyed by file path and content hash.

```typescript
interface FileViolationCache {
  /** Content hash when cached */
  contentHash: string
  /** Cached client violations */
  clientViolations: Array<ClientViolation>
  /** Cached component metadata */
  components: Array<{
    name: string
    isAsync: boolean
    line: number
  }>
}

const fileCache = new Map<string, FileViolationCache>()

function getFileViolations(sourceFile: ts.SourceFile): Array<ClientViolation> {
  const hash = computeHash(sourceFile.text)
  const cached = fileCache.get(sourceFile.fileName)

  if (cached?.contentHash === hash) {
    return cached.clientViolations
  }

  // Recompute and cache
  const violations = detectViolationsInFile(sourceFile)
  fileCache.set(sourceFile.fileName, {
    contentHash: hash,
    clientViolations: violations,
    components: extractComponentMetadata(sourceFile),
  })

  return violations
}
```

#### 4.2 Import graph cache

Cache which symbols each file imports, enabling quick dependency lookups.

```typescript
interface ImportGraphCache {
  /** Content hash when cached */
  contentHash: string
  /** Imported symbols: Map<localName, { fromFile, exportedName }> */
  imports: Map<string, { fromFile: string; exportedName: string }>
  /** Exported symbols */
  exports: Set<string>
}
```

#### 4.3 Cross-file dependency tracking

Track which files depend on which, for incremental invalidation.

```typescript
interface DependencyGraph {
  /** Files that import this file */
  importedBy: Map<string, Set<string>>
  /** Files this file imports */
  imports: Map<string, Set<string>>
}

function invalidateFile(fileName: string, graph: DependencyGraph) {
  // Clear cache for this file
  fileCache.delete(fileName)

  // Clear cache for files that import this file
  const dependents = graph.importedBy.get(fileName) ?? new Set()
  for (const dep of dependents) {
    fileCache.delete(dep)
  }
}
```

#### 4.4 LRU eviction for memory management

```typescript
import { LRUCache } from 'lru-cache'

const fileCache = new LRUCache<string, FileViolationCache>({
  max: 1000, // Max 1000 files
  ttl: 1000 * 60 * 5, // 5 minute TTL
})
```

---

## File Changes Summary

### New Files

| File                                | Description                                            |
| ----------------------------------- | ------------------------------------------------------ |
| `src/shared/use-client-resolver.ts` | Moved from `rules/no-client-code-in-server-component/` |
| `src/shared/component-resolver.ts`  | New: Resolve component symbols                         |
| `src/shared/transitive-walker.ts`   | New: Unified transitive analysis                       |
| `src/shared/types.ts`               | New: Shared type definitions                           |

### Modified Files

| File                                                                                      | Changes                       |
| ----------------------------------------------------------------------------------------- | ----------------------------- |
| `src/rules/no-async-client-component/no-async-client-component.rule.ts`                   | Complete rewrite to on-demand |
| `src/rules/no-client-code-in-server-component/no-client-code-in-server-component.rule.ts` | Use shared utilities          |

### Deleted / Retired Files

| File                                                                  | Reason                                     |
| --------------------------------------------------------------------- | ------------------------------------------ |
| `src/rules/no-async-client-component/render-graph-builder.ts`         | Eventually retired after on-demand parity  |
| `src/rules/no-async-client-component/context-analyzer.ts`             | Eventually retired after on-demand parity  |
| `src/rules/no-client-code-in-server-component/use-client-resolver.ts` | Moved to shared                            |
| `src/rules/no-client-code-in-server-component/transitive-analyzer.ts` | (Optional) later replaced by shared walker |

---

## Performance Expectations

### Before Optimization

| Metric          | Value                              |
| --------------- | ---------------------------------- |
| Files scanned   | All files in program               |
| Time complexity | O(files × avg components per file) |
| Memory          | Full component graph in memory     |

### After Optimization

| Metric          | Value                                         |
| --------------- | --------------------------------------------- |
| Files scanned   | Only entry point files + reachable components |
| Time complexity | O(entry points × avg reachable depth)         |
| Memory          | Only active analysis path                     |

### Example: 5000 files, 10 routes, 50 components per route

| Metric             | Before            | After           | Improvement |
| ------------------ | ----------------- | --------------- | ----------- |
| File visits        | ~5000             | ~500            | 10x         |
| Components indexed | ~2000             | ~500            | 4x          |
| Memory usage       | High (full graph) | Low (path only) | ~10x        |

---

## Testing Strategy

### Unit Tests

1. **Shared utilities:**
   - `use-client-resolver.ts`: Test directive detection
   - `component-resolver.ts`: Test symbol resolution
   - `transitive-walker.ts`: Test walk behavior, caching, boundary detection

2. **Rule behavior:**
   - Existing tests should continue to pass
   - Add tests for edge cases in on-demand analysis

### E2E Tests

Use `e2e/eslint-plugin-start/` project to verify:

1. Cross-file analysis still works
2. No false positives from lazy analysis
3. Performance improvement on large fixture sets

### Performance Benchmarks

Create benchmark script:

```typescript
// scripts/benchmark-eslint-rules.ts
import { ESLint } from 'eslint'
import { performance } from 'perf_hooks'

async function benchmark(name: string, fn: () => Promise<void>) {
  const start = performance.now()
  await fn()
  const end = performance.now()
  console.log(`${name}: ${(end - start).toFixed(2)}ms`)
}

// Run on large fixture set
await benchmark('no-async-client-component', async () => {
  const eslint = new ESLint({
    /* config */
  })
  await eslint.lintFiles(['fixtures/large-project/**/*.tsx'])
})
```

---

## Migration Notes

### Breaking Changes

None expected. The rules produce the same errors, just faster.

### Deprecation

- Internal APIs (`RenderGraph`, `ContextAnalysisResult`) are removed
- These were never part of public API

### Rollback Plan

If issues arise, revert to commit before Phase 2 changes.

---

## Timeline Estimate

| Phase                                       | Effort    | Dependencies |
| ------------------------------------------- | --------- | ------------ |
| Phase 1: Extract shared utilities           | 2-3 hours | None         |
| Phase 2: Refactor no-async-client-component | 4-6 hours | Phase 1      |
| Phase 3: Unify transitive analysis          | 3-4 hours | Phase 2      |
| Phase 4: Enhanced caching                   | Future    | Phase 3      |

**Total: ~10-13 hours for Phases 1-3**
