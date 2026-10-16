import path from 'node:path'
import { ESLintUtils } from '@typescript-eslint/utils'
import * as ts from 'typescript'
import { getDocsUrl } from '../../utils/get-docs-url'
import { createUseClientResolver } from '../../shared/use-client-resolver'
import { createViolationDetector } from './violation-detector'
import { createTransitiveAnalyzer } from './transitive-analyzer'
import { DEFAULT_ALLOWED_HOOKS } from './constants'
import type { Violation, ViolationType } from './violation-detector'
import type { ImportEdge } from './transitive-analyzer'
import type { ExtraRuleDocs } from '../../types'
import type { TSESTree } from '@typescript-eslint/utils'

export const name = 'no-client-code-in-server-component'

type MessageIds =
  | 'hookInServerComponent'
  | 'browserGlobalInServerComponent'
  | 'eventHandlerInServerComponent'
  | 'functionPropInServerComponent'
  | 'classComponentInServerComponent'

type _Options = [
  {
    allowedServerHooks?: Array<string>
  },
]

const SLOT_HINT =
  'To use client functionality, either: (1) pass the client component as a prop/slot to the server component, or (2) move this code to a separate file and add "use client" directive.'

const TRIGGER_HINT = 'Triggered by rendering "{{entry}}".'

export const rule = ESLintUtils.RuleCreator<ExtraRuleDocs>(getDocsUrl)({
  name,
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow client-only code inside server components',
      recommended: 'error',
    },
    schema: [
      {
        type: 'object',
        properties: {
          allowedServerHooks: {
            type: 'array',
            items: { type: 'string' },
            description:
              'Additional hooks that are allowed in server components (e.g., custom server-safe hooks)',
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      hookInServerComponent:
        '"{{name}}" hook {{location}} cannot be used in server components. ' +
        TRIGGER_HINT +
        ' ' +
        SLOT_HINT,
      browserGlobalInServerComponent:
        '"{{name}}" browser API {{location}} is not available in server components. ' +
        TRIGGER_HINT +
        ' ' +
        SLOT_HINT,
      eventHandlerInServerComponent:
        '"{{name}}" event handler {{location}} cannot be used in server components. ' +
        TRIGGER_HINT +
        ' ' +
        SLOT_HINT,
      functionPropInServerComponent:
        '"{{name}}" function prop {{location}} cannot be passed in server components. ' +
        'Functions cannot be serialized from server to client. ' +
        TRIGGER_HINT +
        ' ' +
        SLOT_HINT,
      classComponentInServerComponent:
        '"{{name}}" class component {{location}} cannot be used in server components. ' +
        'Class components require client-side lifecycle methods. ' +
        TRIGGER_HINT +
        ' ' +
        SLOT_HINT,
    },
  },
  defaultOptions: [{ allowedServerHooks: [] }] as const,
  create(context, [options]) {
    // Get TypeScript services
    const services = ESLintUtils.getParserServices(context)
    const program = services.program
    const checker = program.getTypeChecker()

    // Build allowed hooks set from options
    const allowedHooks = new Set([
      ...DEFAULT_ALLOWED_HOOKS,
      ...options.allowedServerHooks,
    ])

    // Initialize analyzers
    const useClientResolver = createUseClientResolver(program)
    const violationDetector = createViolationDetector(ts, {
      allowedHooks,
      checker,
    })
    const transitiveAnalyzer = createTransitiveAnalyzer(
      ts,
      program,
      checker,
      useClientResolver,
      violationDetector,
    )

    return {
      // Find server-component roots
      CallExpression(node) {
        // Skip client files
        const sourceFile = services.esTreeNodeToTSNodeMap
          .get(node)
          .getSourceFile()
        if (useClientResolver.hasUseClientDirective(sourceFile.fileName)) return

        const rootKind = getServerRootKind(node)
        if (!rootKind) return

        if (rootKind === 'createCompositeComponent') {
          const callback = node.arguments[0]
          if (!callback) return

          const tsNode = services.esTreeNodeToTSNodeMap.get(callback)

          if (ts.isFunctionLike(tsNode)) {
            analyzeServerComponentCallback(
              tsNode as ts.FunctionLikeDeclaration,
              node,
              rootKind,
            )
          } else if (ts.isIdentifier(tsNode)) {
            analyzeDirectComponentReference(tsNode, node, rootKind)
          }

          return
        }

        const element = node.arguments[0]
        if (!element) return

        const tsNode = services.esTreeNodeToTSNodeMap.get(element)
        analyzeServerComponentNode(tsNode, node, rootKind)
        return
      },
    }

    function getServerRootKind(
      node: TSESTree.CallExpression,
    ): 'createCompositeComponent' | 'renderServerComponent' | null {
      if (node.callee.type === 'Identifier') {
        if (node.callee.name === 'createCompositeComponent') {
          return 'createCompositeComponent'
        }
        if (node.callee.name === 'renderServerComponent') {
          return 'renderServerComponent'
        }
      }
      if (
        node.callee.type === 'MemberExpression' &&
        node.callee.property.type === 'Identifier'
      ) {
        if (node.callee.property.name === 'createCompositeComponent') {
          return 'createCompositeComponent'
        }
        if (node.callee.property.name === 'renderServerComponent') {
          return 'renderServerComponent'
        }
      }
      return null
    }

    function analyzeServerComponentNode(
      node: ts.Node,
      eslintNode: TSESTree.CallExpression,
      rootKind: 'createCompositeComponent' | 'renderServerComponent',
    ) {
      // Track reported violations to avoid duplicates
      const reportedViolations = new Set<string>()

      const sourceFile = node.getSourceFile()

      // Detect violations in the whole arg node
      const directViolations = violationDetector.detectViolations(sourceFile)
      const start = node.getStart()
      const end = node.getEnd()

      for (const violation of directViolations) {
        const violationPos = violation.node.getStart()
        if (violationPos >= start && violationPos <= end) {
          const key = `${violation.fileName}:${violation.line}:${violation.name}`
          if (!reportedViolations.has(key)) {
            reportedViolations.add(key)
            reportViolation(violation, [], rootKind, eslintNode)
          }
        }
      }

      // Find all JSX component references in the node
      const componentRefs = findComponentReferences(node)

      for (const ref of componentRefs) {
        const symbol = checker.getSymbolAtLocation(ref)
        if (!symbol) continue

        const resolvedSymbol =
          ts.SymbolFlags.Alias & symbol.flags
            ? checker.getAliasedSymbol(symbol)
            : symbol

        const result = transitiveAnalyzer.analyzeEntrySymbol(resolvedSymbol)

        if (result.isClientBoundary) continue

        for (const violation of result.violations) {
          const key = `${violation.fileName}:${violation.line}:${violation.name}`
          if (!reportedViolations.has(key)) {
            reportedViolations.add(key)
            reportViolation(violation, violation.chain, rootKind, eslintNode)
          }
        }
      }
    }

    function analyzeServerComponentCallback(
      callback: ts.FunctionLikeDeclaration,
      eslintNode: TSESTree.CallExpression,
      rootKind: 'createCompositeComponent' | 'renderServerComponent',
    ) {
      // Track reported violations to avoid duplicates
      const reportedViolations = new Set<string>()

      // Collect parameter names - these are "slots" passed from client, skip them
      const parameterNames = new Set<string>()
      for (const param of callback.parameters) {
        collectParameterBindings(param.name, parameterNames)
      }

      // First, detect violations directly in the callback body
      const body = callback.body
      if (body) {
        const sourceFile = callback.getSourceFile()

        // Check for violations in the callback itself
        const directViolations = violationDetector.detectViolations(sourceFile)

        // Filter to only violations within the callback body
        const callbackStart = body.getStart()
        const callbackEnd = body.getEnd()

        for (const violation of directViolations) {
          const violationPos = violation.node.getStart()
          if (violationPos >= callbackStart && violationPos <= callbackEnd) {
            const key = `${violation.fileName}:${violation.line}:${violation.name}`
            if (!reportedViolations.has(key)) {
              reportedViolations.add(key)
              reportViolation(violation, [], rootKind, eslintNode)
            }
          }
        }
      }

      // Find all JSX component references in the callback
      const componentRefs = findComponentReferences(callback)

      for (const ref of componentRefs) {
        // Skip if this component name comes from a parameter (it's a client slot)
        if (parameterNames.has(ref.text)) {
          continue
        }

        const symbol = checker.getSymbolAtLocation(ref)
        if (!symbol) continue

        // Check if the symbol is declared in the callback parameters
        // This handles destructured props like { ActionButton }
        const declarations = symbol.getDeclarations()
        if (declarations?.some((d) => isWithinParameters(d, callback))) {
          continue // Skip - it's a prop/slot
        }

        // Resolve alias if it's an import
        const resolvedSymbol =
          ts.SymbolFlags.Alias & symbol.flags
            ? checker.getAliasedSymbol(symbol)
            : symbol

        const result = transitiveAnalyzer.analyzeEntrySymbol(resolvedSymbol)

        if (result.isClientBoundary) continue // Has 'use client', skip

        // Report violations (deduplicated)
        for (const violation of result.violations) {
          const key = `${violation.fileName}:${violation.line}:${violation.name}`
          if (!reportedViolations.has(key)) {
            reportedViolations.add(key)
            reportViolation(violation, violation.chain, rootKind, eslintNode)
          }
        }
      }
    }

    /**
     * Analyze a component passed directly to createCompositeComponent(Component)
     */

    function analyzeDirectComponentReference(
      ref: ts.Identifier,
      eslintNode: TSESTree.CallExpression,
      rootKind:
        | 'createCompositeComponent'
        | 'renderServerComponent' = 'createCompositeComponent',
    ) {
      const symbol = checker.getSymbolAtLocation(ref)
      if (!symbol) return

      // Resolve alias if it's an import
      const resolvedSymbol =
        ts.SymbolFlags.Alias & symbol.flags
          ? checker.getAliasedSymbol(symbol)
          : symbol

      const result = transitiveAnalyzer.analyzeEntrySymbol(resolvedSymbol)

      if (result.isClientBoundary) return // Has 'use client', skip

      // Track reported violations to avoid duplicates
      const reportedViolations = new Set<string>()

      // Report violations (deduplicated)
      for (const violation of result.violations) {
        const key = `${violation.fileName}:${violation.line}:${violation.name}`
        if (!reportedViolations.has(key)) {
          reportedViolations.add(key)
          reportViolation(violation, violation.chain, rootKind, eslintNode)
        }
      }
    }

    /**
     * Collect all binding names from a parameter (handles destructuring)
     */
    function collectParameterBindings(
      bindingName: ts.BindingName,
      names: Set<string>,
    ): void {
      function collectFromBinding(node: ts.BindingName): void {
        if (ts.isIdentifier(node)) {
          names.add(node.text)
        } else if (ts.isObjectBindingPattern(node)) {
          for (const element of node.elements) {
            collectFromBinding(element.name)
          }
        } else if (ts.isArrayBindingPattern(node)) {
          for (const element of node.elements) {
            if (ts.isBindingElement(element)) {
              collectFromBinding(element.name)
            }
          }
        }
      }
      collectFromBinding(bindingName)
    }

    /**
     * Check if a declaration is within the parameters of the callback
     */
    function isWithinParameters(
      decl: ts.Declaration,
      callback: ts.FunctionLikeDeclaration,
    ): boolean {
      // Walk up the parent chain to see if this declaration is within a parameter
      let current: ts.Node | undefined = decl
      while (current) {
        if (ts.isParameter(current)) {
          // Check if this parameter belongs to our callback
          const paramParent = current.parent
          if (ts.isFunctionLike(paramParent) && paramParent === callback) {
            return true
          }
        }
        current = current.parent as ts.Node | undefined
      }
      return false
    }

    function findComponentReferences(node: ts.Node): Array<ts.Identifier> {
      const refs: Array<ts.Identifier> = []

      function visit(n: ts.Node) {
        // JSX element: <Component />
        if (ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n)) {
          const tagName = n.tagName
          // Only components (uppercase) not intrinsic elements (lowercase)
          if (ts.isIdentifier(tagName) && /^[A-Z]/.test(tagName.text)) {
            refs.push(tagName)
          }
        }
        // Also check function calls that might return JSX
        if (ts.isCallExpression(n)) {
          const callee = n.expression
          if (ts.isIdentifier(callee) && /^[A-Z]/.test(callee.text)) {
            refs.push(callee)
          }
        }
        ts.forEachChild(n, visit)
      }

      ts.forEachChild(node, visit)
      return refs
    }

    function reportViolation(
      violation: Violation,
      chain: Array<ImportEdge>,
      entryComponentName: string,
      eslintNode: TSESTree.CallExpression,
    ) {
      const location = formatLocation(violation, chain)
      const messageId = getMessageId(violation.type)

      context.report({
        node: eslintNode,
        messageId,
        data: {
          name: violation.name,
          location,
          entry: entryComponentName,
          fileName: getRelativePath(violation.fileName),
        },
      })
    }

    function getMessageId(type: ViolationType): MessageIds {
      switch (type) {
        case 'hook':
          return 'hookInServerComponent'
        case 'browser-global':
          return 'browserGlobalInServerComponent'
        case 'event-handler':
          return 'eventHandlerInServerComponent'
        case 'function-prop':
          return 'functionPropInServerComponent'
        case 'class-component':
          return 'classComponentInServerComponent'
      }
    }

    function formatLocation(
      violation: Violation,
      chain: Array<ImportEdge>,
    ): string {
      if (chain.length > 0) {
        const chainStr = chain
          .map((e) => getRelativePath(e.toFile))
          .join(' -> ')
        return `(via ${chainStr}) at ${getRelativePath(violation.fileName)}:${violation.line}`
      }
      return `at ${getRelativePath(violation.fileName)}:${violation.line}`
    }

    function getRelativePath(fileName: string): string {
      const cwd = context.cwd
      return path.relative(cwd, fileName)
    }
  },
})
