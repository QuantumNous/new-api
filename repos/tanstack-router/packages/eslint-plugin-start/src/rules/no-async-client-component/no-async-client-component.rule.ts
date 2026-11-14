import path from 'node:path'
import { ESLintUtils } from '@typescript-eslint/utils'
import * as ts from 'typescript'
import { getDocsUrl } from '../../utils/get-docs-url'
import { createRenderGraphBuilder } from './render-graph-builder'
import { analyzeContext } from './context-analyzer'
import type { ClientReason, ContextAnalysisResult } from './context-analyzer'
import type { ExtraRuleDocs } from '../../types'

export const name = 'no-async-client-component'

// Cache full graph per program (built rarely due to gating).
const perProgramCache = new WeakMap<
  ts.Program,
  {
    builder: ReturnType<typeof createRenderGraphBuilder>
    graphBuilt: boolean
  }
>()

// Cache for on-demand subgraph analysis per entry file
const onDemandCache = new WeakMap<
  ts.Program,
  Map<
    string,
    {
      graph: ReturnType<ReturnType<typeof createRenderGraphBuilder>['getGraph']>
      analysis: ContextAnalysisResult
    }
  >
>()

// Cache adjacency per program to avoid O(allEdges) scans while slicing
const adjacencyCache = new WeakMap<ts.Program, Map<string, Set<string>>>()

export const rule = ESLintUtils.RuleCreator<ExtraRuleDocs>(getDocsUrl)({
  name,
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow async components in client context. Async components are only valid inside server components.',

      recommended: 'error',
    },
    schema: [
      {
        type: 'object',
        properties: {
          ignorePatterns: {
            type: 'array',
            items: { type: 'string' },
            description: 'File patterns to ignore',
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      asyncClientComponentDefinition:
        'Async component "{{name}}" cannot be used in client context. ' +
        'Async components are only valid inside server components. ' +
        'Either remove "async" or ensure this component is only rendered within server components. ' +
        '{{reason}}',
      asyncClientComponentUsage:
        'Async component "{{name}}" is rendered in client context here. ' +
        'Async components are only valid inside server components. ' +
        'Move this to a server component or use a non-async version.',
    },
  },
  defaultOptions: [{ ignorePatterns: [] }] as const,
  create(context, [options]) {
    const services = ESLintUtils.getParserServices(context)
    const program = services.program
    const checker = program.getTypeChecker()
    // Normalize the current file path to absolute
    const currentFile = path.isAbsolute(context.filename)
      ? context.filename
      : path.resolve(context.cwd, context.filename)

    // Check if file should be ignored
    const ignorePatterns = [...options.ignorePatterns]
    if (shouldIgnore(currentFile, ignorePatterns)) {
      return {}
    }

    // Build full graph once (still gated per-file above).
    let cached = perProgramCache.get(program)
    if (!cached) {
      const builder = createRenderGraphBuilder(ts, program, checker)
      cached = { builder, graphBuilt: false }
      perProgramCache.set(program, cached)
    }

    // Track reported to avoid duplicates
    const reported = new Set<string>()

    return {
      Program() {
        // Fast path: if current file can’t introduce client roots, skip.
        // This avoids full-program graph build for most files.
        const sourceFile = program.getSourceFile(currentFile)
        if (
          !sourceFile ||
          (!fileContainsRouteOptions(sourceFile) &&
            !fileContainsServerComponentRoots(sourceFile) &&
            !fileHasUseClientDirective(sourceFile))
        ) {
          return
        }

        // Ensure route-option cases are always analyzed (e2e runs ESLint per-file).
        // On-demand caching is still used for perf; this just avoids missing route roots.
        if (fileContainsRouteOptions(sourceFile)) {
          // no-op: gate ensures analysis runs
        }

        // On-demand: build only the subgraph reachable from this file's entry points,
        // then analyze contexts within that subgraph.
        const analysis = getOnDemandAnalysis(currentFile)

        // Report async components in client context
        for (const [key, ctx] of analysis.contexts) {
          if (!ctx.component.isAsync || !ctx.isClientContext) {
            continue
          }

          const reportKey = `def:${key}`
          if (reported.has(reportKey)) continue

          // For route-option cases, ONLY report at usage site (in the route file)
          if (ctx.clientReason?.type === 'route-option') {
            const usageFile = ctx.clientReason.usageFile
            if (usageFile && usageFile === currentFile) {
              const usageTsNode = ctx.clientReason.usageNode as ts.Node
              const usageEslintNode =
                services.tsNodeToESTreeNodeMap.get(usageTsNode)
              // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Map.get() can return undefined
              if (usageEslintNode) {
                reported.add(reportKey)
                context.report({
                  node: usageEslintNode,
                  messageId: 'asyncClientComponentDefinition',
                  data: {
                    name: ctx.component.name,
                    reason: formatReason(ctx.clientReason, context.cwd),
                  },
                })
              }
            }
            continue
          }

          reported.add(reportKey)

          // For other cases (use-client, rendered-by-client): report at definition site
          const tsNode = ctx.component.node
          const eslintNode = services.tsNodeToESTreeNodeMap.get(tsNode)

          // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Map.get() can return undefined
          if (eslintNode) {
            context.report({
              node: eslintNode,
              messageId: 'asyncClientComponentDefinition',
              data: {
                name: ctx.component.name,
                reason: ctx.clientReason
                  ? formatReason(ctx.clientReason, context.cwd)
                  : '',
              },
            })
          }
        }

        // Report usage sites where async component is rendered in client context
        for (const edge of analysis.clientEdges) {
          const targetCtx = analysis.contexts.get(edge.toComponentKey)
          if (!targetCtx?.component.isAsync) continue

          if (edge.fromFile !== currentFile) continue

          const reportKey = `usage:${edge.fromFile}:${edge.jsxLine}:${edge.toComponent}`
          if (reported.has(reportKey)) continue
          reported.add(reportKey)

          const eslintNode = services.tsNodeToESTreeNodeMap.get(edge.jsxNode)
          // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Map.get() can return undefined
          if (eslintNode) {
            context.report({
              node: eslintNode,
              messageId: 'asyncClientComponentUsage',
              data: {
                name: edge.toComponent,
              },
            })
          }
        }
      },
    }

    function shouldIgnore(filePath: string, patterns: Array<string>): boolean {
      for (const pattern of patterns) {
        if (filePath.includes(pattern)) {
          return true
        }
      }
      return false
    }

    function formatReason(reason: ClientReason, cwd: string): string {
      switch (reason.type) {
        case 'use-client':
          return `File has "use client" directive.`
        case 'route-option':
          return `Component is referenced by a route option (createFileRoute/createRootRoute).`
        case 'rendered-by-client':
          return `Rendered by client component "${reason.parentComponent}" in ${path.relative(cwd, reason.parentFile)}.`
      }
    }

    function getOnDemandAnalysis(entryFile: string): ContextAnalysisResult {
      let programCache = onDemandCache.get(program)
      if (!programCache) {
        programCache = new Map()
        onDemandCache.set(program, programCache)
      }

      const cachedResult = programCache.get(entryFile)
      if (cachedResult) return cachedResult.analysis

      // Build a complete graph once (still gated), then slice it to
      // only what’s reachable from entry points in `entryFile`.
      if (!cached!.graphBuilt) {
        cached!.builder.build()
        cached!.graphBuilt = true
      }
      const full = cached!.builder.getGraph()

      const subgraph = sliceGraphForEntryFile(full, entryFile)

      const entrySourceFile = program.getSourceFile(entryFile)
      const shouldFallbackToFull =
        !!entrySourceFile &&
        fileContainsRouteOptions(entrySourceFile) &&
        subgraph.clientRoots.size === 0 &&
        subgraph.serverRoots.size === 0

      // Fallback: if slicing yields nothing but file has route options, analyze full graph.
      const analysis = shouldFallbackToFull
        ? analyzeContext(full)
        : analyzeContext(subgraph)

      programCache.set(entryFile, { graph: subgraph, analysis })
      return analysis
    }

    function sliceGraphForEntryFile(
      full: ReturnType<
        typeof createRenderGraphBuilder
      >['getGraph'] extends () => infer G
        ? G
        : never,
      entryFile: string,
    ) {
      const components = full.components
      const edges = full.edges
      const serverRoots = full.serverRoots
      const clientRoots = full.clientRoots
      const useClientFiles = full.useClientFiles
      const routeOptionUsages = full.routeOptionUsages

      // Determine entry roots from this file.
      const entryClientRoots = new Set<string>()
      const entryServerRoots = new Set<string>()

      // Use the indexed routeOptionRootsByFile for O(roots-in-file) lookup
      const routeRootsInFile =
        routeOptionUsages.size > 0
          ? full.routeOptionRootsByFile.get(entryFile)
          : undefined
      if (routeRootsInFile) {
        for (const key of routeRootsInFile) {
          if (clientRoots.has(key)) {
            entryClientRoots.add(key)
          }
        }
      }

      for (const key of serverRoots) {
        const component = components.get(key)
        if (component?.fileName === entryFile) {
          entryServerRoots.add(key)
        }
      }

      // If it’s a use-client file, also treat local components as client roots.
      if (useClientFiles.has(entryFile)) {
        for (const [key, component] of components) {
          if (component.fileName === entryFile) {
            entryClientRoots.add(key)
          }
        }
      }

      const reachable = new Set<string>()
      const queue: Array<string> = []
      for (const r of entryClientRoots) queue.push(r)
      for (const r of entryServerRoots) queue.push(r)

      const adjacency = getAdjacency(full)

      while (queue.length) {
        const key = queue.pop()!
        if (reachable.has(key)) continue
        reachable.add(key)

        const children = adjacency.get(key)
        if (!children) continue
        for (const toKey of children) {
          if (!reachable.has(toKey)) {
            queue.push(toKey)
          }
        }
      }

      const subComponents = new Map<string, any>()
      for (const key of reachable) {
        const comp = components.get(key)
        if (comp) subComponents.set(key, comp)
      }

      const subEdges = edges.filter((edge) => {
        const fromKey = `${edge.fromFile}:${edge.fromComponent}`
        return reachable.has(fromKey) && reachable.has(edge.toComponentKey)
      })

      const subServerRoots = new Set(
        [...entryServerRoots].filter((k) => reachable.has(k)),
      )
      const subClientRoots = new Set(
        [...entryClientRoots].filter((k) => reachable.has(k)),
      )

      // Keep only routeUsage for roots we kept.
      const subRouteOptionUsages = new Map<string, any>()
      const subRouteOptionRootsByFile = new Map<string, Set<string>>()
      for (const key of subClientRoots) {
        const usage = routeOptionUsages.get(key)
        if (usage) {
          subRouteOptionUsages.set(key, usage)
          let set = subRouteOptionRootsByFile.get(usage.fileName)
          if (!set) {
            set = new Set()
            subRouteOptionRootsByFile.set(usage.fileName, set)
          }
          set.add(key)
        }
      }

      return {
        components: subComponents,
        edges: subEdges,
        serverRoots: subServerRoots,
        clientRoots: subClientRoots,
        useClientFiles,
        routeOptionUsages: subRouteOptionUsages,
        routeOptionRootsByFile: subRouteOptionRootsByFile,
      }
    }

    function getAdjacency(full: { edges: Array<any> }) {
      let cachedAdjacency = adjacencyCache.get(program)
      if (cachedAdjacency) return cachedAdjacency

      cachedAdjacency = new Map()
      for (const edge of full.edges) {
        const fromKey = `${edge.fromFile}:${edge.fromComponent}`
        let set = cachedAdjacency.get(fromKey)
        if (!set) {
          set = new Set()
          cachedAdjacency.set(fromKey, set)
        }
        set.add(edge.toComponentKey)
      }

      adjacencyCache.set(program, cachedAdjacency)
      return cachedAdjacency
    }

    function fileHasUseClientDirective(sourceFile: ts.SourceFile): boolean {
      const firstStmt = sourceFile.statements[0]
      if (!firstStmt) return false
      return (
        ts.isExpressionStatement(firstStmt) &&
        ts.isStringLiteral(firstStmt.expression) &&
        firstStmt.expression.text === 'use client'
      )
    }

    function fileContainsServerComponentRoots(
      sourceFile: ts.SourceFile,
    ): boolean {
      // Cheaper than full AST traversal; ok since this is only a gate.
      const text = sourceFile.text
      return (
        text.includes('renderServerComponent') ||
        text.includes('createCompositeComponent')
      )
    }

    function fileContainsRouteOptions(sourceFile: ts.SourceFile): boolean {
      // Cheaper than full AST traversal; ok since this is only a gate.
      const text = sourceFile.text
      if (
        !text.includes('createFileRoute') &&
        !text.includes('createRootRoute') &&
        !text.includes('createRootRouteWithContext')
      ) {
        return false
      }

      return (
        text.includes('component') ||
        text.includes('pendingComponent') ||
        text.includes('errorComponent') ||
        text.includes('notFoundComponent')
      )
    }
  },
})
