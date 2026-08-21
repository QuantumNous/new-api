import { relative } from 'node:path'
import crypto from 'node:crypto'
import babel from '@babel/core'
import * as t from '@babel/types'
import {
  buildDeclarationMap,
  buildDependencyGraph,
  collectIdentifiersFromNode,
  collectIdentifiersFromPattern,
  collectLocalBindingsFromStatement,
  deadCodeElimination,
  expandTransitively,
  findReferencedIdentifiers,
  generateFromAst,
  parseAst,
  removeModuleLevelBindings,
  retainModuleLevelDeclarations,
  stripUnreferencedTopLevelExpressionStatements,
  unwrapExportedDeclarations,
} from '@tanstack/router-utils'
import { tssHydrate } from './hydration-constants'
import { cleanId, codeFrameError } from './start-compiler/utils'
import type {
  CompileStartFrameworkOptions,
  StartCompilerPlugin,
  StartCompilerTransformResult,
} from './types'

export class MissingHydrateSourceError extends Error {
  constructor(id: string) {
    super(
      `Missing Hydrate source for virtual module ${id}. The parent module must be transformed before its Hydrate child chunk is loaded.`,
    )
  }
}

/**
 * Detection pattern used by the transform code filter to pre-scan files for
 * `<Hydrate>` JSX before any AST parsing happens.
 */
const HYDRATE_DETECTION_PATTERN = /\bHydrate\b/

function createBoundaryId(root: string, sourceId: string) {
  const normalized = relative(root, sourceId).replaceAll('\\', '/')
  const sourceHash = crypto
    .createHash('sha1')
    .update(normalized)
    .digest('hex')
    .slice(0, 10)

  return (index: number) => {
    return `${index.toString(36)}_${sourceHash}`
  }
}

function getJSXElementName(node: t.JSXElement) {
  const name = node.openingElement.name
  return t.isJSXIdentifier(name) ? name.name : undefined
}

function getJSXAttribute(node: t.JSXOpeningElement, name: string) {
  for (const item of node.attributes) {
    if (t.isJSXAttribute(item) && t.isJSXIdentifier(item.name, { name })) {
      return item
    }
  }

  return undefined
}

function getBooleanProp(node: t.JSXOpeningElement, name: string) {
  const attr = getJSXAttribute(node, name)
  if (!attr) return undefined
  if (!attr.value) return true
  if (t.isStringLiteral(attr.value)) return attr.value.value !== 'false'
  if (t.isJSXExpressionContainer(attr.value)) {
    if (t.isBooleanLiteral(attr.value.expression)) {
      return attr.value.expression.value
    }
  }
  return undefined
}

function parseHydrateVirtualId(id: string) {
  const queryIndex = id.indexOf('?')
  const sourceId = cleanId(queryIndex === -1 ? id : id.slice(0, queryIndex))
  if (queryIndex === -1) {
    return { sourceId, splitId: null, boundaryIndex: -1 }
  }

  const rawQuery = id.slice(queryIndex + 1)
  const params = new URLSearchParams(rawQuery)
  const splitId = params.get(tssHydrate)
  let boundaryIndex = -1
  if (splitId) {
    const separatorIndex = splitId.indexOf('_')
    if (separatorIndex > 0) {
      const parsedIndex = Number.parseInt(splitId.slice(0, separatorIndex), 36)
      if (Number.isInteger(parsedIndex)) {
        boundaryIndex = parsedIndex
      }
    }
  }

  return {
    sourceId,
    splitId,
    boundaryIndex,
  }
}

function isObjectPropertyName(
  property: t.ObjectMethod | t.ObjectProperty,
  name: string,
) {
  if (t.isIdentifier(property.key) && !property.computed) {
    return property.key.name === name
  }

  return t.isStringLiteral(property.key) && property.key.value === name
}

function isReferenceInsideAnyNode(
  referencePath: babel.NodePath,
  nodes: ReadonlySet<t.Node>,
) {
  if (nodes.has(referencePath.node)) return true
  return Boolean(referencePath.findParent((parent) => nodes.has(parent.node)))
}

function stripBindingsOnlyReferencedBy(
  path: babel.NodePath<t.JSXElement>,
  node: t.Node,
  seen = new Set<string>(),
  preserve = new Set<string>(),
) {
  stripBindingsOnlyReferencedByNodes(path.scope, [node], seen, preserve)
}

function stripBindingsOnlyReferencedByNodes(
  scope: babel.NodePath['scope'],
  nodes: ReadonlyArray<t.Node>,
  seen = new Set<string>(),
  preserve = new Set<string>(),
) {
  const nodeSet = new Set(nodes)
  const names = new Set<string>()
  nodes.forEach((node) => {
    collectIdentifiersFromNode(node).forEach((name) => names.add(name))
  })

  for (const name of names) {
    if (seen.has(name)) continue
    if (preserve.has(name)) continue
    const binding = scope.getBinding(name)
    if (!binding?.constant) continue
    if (
      binding.path.findParent(
        (parentPath) =>
          parentPath.isExportNamedDeclaration() ||
          parentPath.isExportDefaultDeclaration(),
      )
    ) {
      continue
    }
    if (binding.referencePaths.length === 0) continue
    if (
      !binding.referencePaths.every((referencePath) =>
        isReferenceInsideAnyNode(referencePath, nodeSet),
      )
    ) {
      continue
    }

    seen.add(name)

    const declarationPath = binding.path.isVariableDeclarator()
      ? binding.path
      : binding.path.findParent((parentPath) =>
          parentPath.isVariableDeclarator(),
        )
    const patternHasExternalReferences =
      declarationPath?.isVariableDeclarator() &&
      !t.isIdentifier(declarationPath.node.id) &&
      collectIdentifiersFromPattern(declarationPath.node.id).some(
        (bindingName) => {
          if (bindingName === binding.identifier.name) return false

          const siblingBinding = binding.scope.getBinding(bindingName)
          return siblingBinding?.referencePaths.some(
            (referencePath) =>
              !isReferenceInsideAnyNode(referencePath, nodeSet),
          )
        },
      )

    if (patternHasExternalReferences) {
      continue
    }

    const bindingNode = binding.path.node
    if (t.isVariableDeclarator(bindingNode) && bindingNode.init) {
      stripBindingsOnlyReferencedByNodes(
        binding.scope,
        [bindingNode.init],
        seen,
        preserve,
      )
    } else if (
      t.isFunctionDeclaration(bindingNode) ||
      t.isClassDeclaration(bindingNode)
    ) {
      stripBindingsOnlyReferencedByNodes(
        binding.scope,
        [bindingNode],
        seen,
        preserve,
      )
    }

    if (binding.path.isVariableDeclarator()) {
      const declarationPath = binding.path.parentPath
      if (
        declarationPath.isVariableDeclaration() &&
        declarationPath.node.declarations.length === 1
      ) {
        declarationPath.remove()
        continue
      }

      binding.path.remove()
      continue
    }

    if (
      binding.path.isImportSpecifier() ||
      binding.path.isImportDefaultSpecifier() ||
      binding.path.isImportNamespaceSpecifier()
    ) {
      const importPath = binding.path.parentPath
      if (
        importPath.isImportDeclaration() &&
        importPath.node.specifiers.length === 1
      ) {
        importPath.remove()
        continue
      }

      binding.path.remove()
      continue
    }

    binding.path.remove()
  }
}

function getSingleUseObjectExpressionBinding(
  path: babel.NodePath<t.JSXElement>,
  identifier: t.Identifier,
) {
  const binding = path.scope.getBinding(identifier.name)
  if (!binding?.constant) return undefined
  if (binding.referencePaths.length !== 1) return undefined
  if (binding.referencePaths[0]?.node !== identifier) return undefined
  if (!binding.path.isVariableDeclarator()) return undefined
  const init = binding.path.node.init
  return t.isObjectExpression(init) ? init : undefined
}

function objectExpressionMayHaveProperty(
  node: t.ObjectExpression,
  name: string,
) {
  return node.properties.some((property) => {
    if (t.isSpreadElement(property)) return true
    if (!t.isObjectMethod(property) && !t.isObjectProperty(property)) {
      return true
    }
    if (property.computed) return true
    return isObjectPropertyName(property, name)
  })
}

function stripObjectExpressionProperty(
  path: babel.NodePath<t.JSXElement>,
  node: t.ObjectExpression,
  name: string,
) {
  let modified = false

  node.properties = node.properties.filter((property) => {
    if (
      (t.isObjectMethod(property) || t.isObjectProperty(property)) &&
      isObjectPropertyName(property, name)
    ) {
      stripBindingsOnlyReferencedBy(
        path,
        t.isObjectProperty(property) ? property.value : property.body,
      )
      modified = true
      return false
    }

    return true
  })

  return modified
}

function throwBoundaryError(
  code: string,
  path: babel.NodePath<t.JSXElement>,
  message: string,
): never {
  if (path.node.loc) {
    throw codeFrameError(code, path.node.loc, message)
  }
  throw new Error(message)
}

function inspectSplitBoundary(options: {
  code: string
  path: babel.NodePath<t.JSXElement>
  validate?: boolean
  collectCaptured?: boolean
  nestedHydrate?: {
    localName: string
  }
}) {
  const { path } = options
  const capturedNames = options.collectCaptured ? new Set<string>() : undefined
  const nestedHydrate = options.nestedHydrate
  let nestedBoundaryCount = 0

  if (options.validate) {
    for (const child of path.node.children) {
      if (
        t.isJSXExpressionContainer(child) &&
        (t.isFunctionExpression(child.expression) ||
          t.isArrowFunctionExpression(child.expression))
      ) {
        throwBoundaryError(
          options.code,
          path,
          'Hydrate cannot code-split function-as-children. Use split={false} for this boundary.',
        )
      }
    }
  }

  const rootVisitors = {
    JSXOpeningElement(openingPath: babel.NodePath<t.JSXOpeningElement>) {
      if (openingPath.node === path.node.openingElement) {
        openingPath.skip()
      }
    },
    JSXClosingElement(closingPath: babel.NodePath<t.JSXClosingElement>) {
      closingPath.skip()
    },
  }

  const validateVisitors = options.validate
    ? {
        CallExpression(callPath: babel.NodePath<t.CallExpression>) {
          if (!t.isIdentifier(callPath.node.callee)) return
          if (!/^use[A-Z0-9]/.test(callPath.node.callee.name)) return

          throwBoundaryError(
            options.code,
            path,
            'Hydrate cannot code-split JSX that calls hooks during render. Move the hook call into a child component or use split={false}.',
          )
        },
        ThisExpression(thisPath: babel.NodePath<t.ThisExpression>) {
          void thisPath
          throwBoundaryError(
            options.code,
            path,
            'Hydrate cannot code-split JSX that captures this.',
          )
        },
        Super(superPath: babel.NodePath<t.Super>) {
          void superPath
          throwBoundaryError(
            options.code,
            path,
            'Hydrate cannot code-split JSX that captures super.',
          )
        },
      }
    : {}

  const nestedHydrateVisitors = nestedHydrate
    ? {
        JSXElement(nestedPath: babel.NodePath<t.JSXElement>) {
          if (getJSXElementName(nestedPath.node) !== nestedHydrate.localName) {
            return
          }

          const split = getBooleanProp(nestedPath.node.openingElement, 'split')
          if (split === false) return

          nestedBoundaryCount++
        },
      }
    : {}

  const captureVisitors = capturedNames
    ? {
        Identifier(identifierPath: babel.NodePath<t.Identifier>) {
          const parent = identifierPath.parent
          if (
            t.isJSXOpeningElement(parent) ||
            t.isJSXClosingElement(parent) ||
            (t.isObjectProperty(parent, { key: identifierPath.node }) &&
              !parent.computed &&
              !parent.shorthand) ||
            (t.isMemberExpression(parent, {
              property: identifierPath.node,
            }) &&
              !parent.computed)
          ) {
            return
          }

          const binding = identifierPath.scope.getBinding(
            identifierPath.node.name,
          )
          if (!binding) return
          if (t.isProgram(binding.scope.block)) return
          if (
            path.node === binding.scope.block ||
            path.isAncestor(binding.path)
          )
            return

          capturedNames.add(identifierPath.node.name)
        },
        JSXIdentifier(identifierPath: babel.NodePath<t.JSXIdentifier>) {
          if (identifierPath.parentKey !== 'name') return
          const name = identifierPath.node.name
          if (!/^[A-Z]/.test(name)) return
          const binding = identifierPath.scope.getBinding(name)
          if (!binding) return
          if (t.isProgram(binding.scope.block)) return

          capturedNames.add(name)
        },
      }
    : {}

  path.traverse({
    ...rootVisitors,
    ...validateVisitors,
    ...nestedHydrateVisitors,
    ...captureVisitors,
  })

  return {
    captured: capturedNames ? [...capturedNames].sort() : [],
    nestedBoundaryCount,
  }
}

function getHydrateImport(
  ast: t.File,
  framework: CompileStartFrameworkOptions,
) {
  const hydrateImportSource = `@tanstack/${framework}-start`

  for (const node of ast.program.body) {
    if (!t.isImportDeclaration(node)) continue
    if (node.source.value !== hydrateImportSource) continue

    for (const specifier of node.specifiers) {
      if (
        t.isImportSpecifier(specifier) &&
        t.isIdentifier(specifier.imported, { name: 'Hydrate' })
      ) {
        return {
          hydrateLocalName: specifier.local.name,
        }
      }
    }
  }

  return undefined
}

function getMeaningfulChildren(
  children: Array<t.JSXElement['children'][number]>,
) {
  return children.filter(
    (child) => !(t.isJSXText(child) && child.value.trim() === ''),
  )
}

function transformHydrateAst(options: {
  ast: t.File
  code: string
  id: string
  root: string
  env: 'client' | 'server'
  framework: CompileStartFrameworkOptions
  indexOffset?: number
}) {
  if (!options.code.includes('Hydrate')) return null

  const hydrateImport = getHydrateImport(options.ast, options.framework)
  if (!hydrateImport) return null
  const { hydrateLocalName: localName } = hydrateImport
  const sourceId = cleanId(options.id)
  const getBoundaryId = createBoundaryId(options.root, sourceId)

  let nextBoundaryIndex = options.indexOffset ?? 0
  const state = {
    modified: false,
    extractedChildNodes: [] as Array<t.Node>,
    capturedNames: new Set<string>(),
  }
  let lazyIdent: t.Identifier | undefined

  babel.traverse(options.ast, {
    Program(programPath) {
      programPath.traverse({
        JSXElement(path) {
          if (getJSXElementName(path.node) !== localName) return

          if (options.env === 'server') {
            path.node.openingElement.attributes =
              path.node.openingElement.attributes.filter((item) => {
                if (
                  t.isJSXAttribute(item) &&
                  t.isJSXIdentifier(item.name, { name: 'fallback' })
                ) {
                  if (item.value) {
                    stripBindingsOnlyReferencedBy(path, item.value)
                  }
                  state.modified = true
                  return false
                }

                if (
                  t.isJSXSpreadAttribute(item) &&
                  t.isObjectExpression(item.argument)
                ) {
                  if (
                    stripObjectExpressionProperty(
                      path,
                      item.argument,
                      'fallback',
                    )
                  ) {
                    state.modified = true
                  }
                  return item.argument.properties.length > 0
                }

                if (
                  t.isJSXSpreadAttribute(item) &&
                  t.isIdentifier(item.argument)
                ) {
                  const init = getSingleUseObjectExpressionBinding(
                    path,
                    item.argument,
                  )
                  if (
                    init &&
                    stripObjectExpressionProperty(path, init, 'fallback')
                  ) {
                    state.modified = true
                  }
                }

                return true
              })
          }

          const split = getBooleanProp(path.node.openingElement, 'split')
          if (split === false) return

          const boundaryInspection = inspectSplitBoundary({
            code: options.code,
            path,
            validate: true,
            collectCaptured: options.env === 'client',
            ...(options.env === 'client'
              ? {
                  nestedHydrate: {
                    localName,
                  },
                }
              : {}),
          })

          const index = nextBoundaryIndex
          nextBoundaryIndex += 1 + boundaryInspection.nestedBoundaryCount
          const id = getBoundaryId(index)
          const exportName = `H${index}`

          const existingHydrateId = getJSXAttribute(
            path.node.openingElement,
            'h',
          )
          if (existingHydrateId) {
            existingHydrateId.value = t.stringLiteral(id)
          } else {
            path.node.openingElement.attributes.push(
              t.jsxAttribute(t.jsxIdentifier('h'), t.stringLiteral(id)),
            )
          }
          state.modified = true

          if (options.env === 'server') return

          const needsPreloadProp = path.node.openingElement.attributes.some(
            (attribute) => {
              if (t.isJSXAttribute(attribute)) {
                return t.isJSXIdentifier(attribute.name, { name: 'prefetch' })
              }

              if (t.isJSXSpreadAttribute(attribute)) {
                if (t.isObjectExpression(attribute.argument)) {
                  return objectExpressionMayHaveProperty(
                    attribute.argument,
                    'prefetch',
                  )
                }

                if (t.isIdentifier(attribute.argument)) {
                  const init = getSingleUseObjectExpressionBinding(
                    path,
                    attribute.argument,
                  )
                  return init
                    ? objectExpressionMayHaveProperty(init, 'prefetch')
                    : true
                }

                return true
              }

              return false
            },
          )
          const childReferenceNodes = getMeaningfulChildren(path.node.children)

          state.extractedChildNodes.push(...childReferenceNodes)
          boundaryInspection.captured.forEach((name) => {
            state.capturedNames.add(name)
          })

          if (!lazyIdent) {
            lazyIdent =
              programPath.scope.generateUidIdentifier('lazyRouteComponent')
            programPath.unshiftContainer('body', [
              t.importDeclaration(
                [
                  t.importSpecifier(
                    lazyIdent,
                    t.identifier('lazyRouteComponent'),
                  ),
                ],
                t.stringLiteral(`@tanstack/${options.framework}-router`),
              ),
            ])
          }

          const importIdParams = new URLSearchParams()
          importIdParams.set(tssHydrate, id)
          const componentIdent =
            programPath.scope.generateUidIdentifier(exportName)
          const declarations = [
            t.variableDeclarator(
              componentIdent,
              t.callExpression(lazyIdent, [
                t.arrowFunctionExpression(
                  [],
                  t.callExpression(t.import(), [
                    t.stringLiteral(`${sourceId}?${importIdParams.toString()}`),
                  ]),
                ),
                t.stringLiteral(exportName),
              ]),
            ),
          ]

          let preloadIdent: t.Identifier | undefined
          if (needsPreloadProp) {
            preloadIdent = programPath.scope.generateUidIdentifier(
              `${exportName}_preload`,
            )
            declarations.push(
              t.variableDeclarator(
                preloadIdent,
                t.memberExpression(componentIdent, t.identifier('preload')),
              ),
            )
          }

          programPath.unshiftContainer('body', [
            t.variableDeclaration('const', declarations),
          ])
          if (preloadIdent) {
            path.node.openingElement.attributes.push(
              t.jsxAttribute(
                t.jsxIdentifier('p'),
                t.jsxExpressionContainer(preloadIdent),
              ),
            )
          }

          path.node.children = [
            t.jsxText('\n'),
            t.jsxExpressionContainer(
              t.jsxElement(
                t.jsxOpeningElement(
                  t.jsxIdentifier(componentIdent.name),
                  boundaryInspection.captured.map((name) =>
                    t.jsxAttribute(
                      t.jsxIdentifier(name),
                      t.jsxExpressionContainer(t.identifier(name)),
                    ),
                  ),
                  true,
                ),
                null,
                [],
                true,
              ),
            ),
            t.jsxText('\n'),
          ]
          path.skip()
        },
      })

      if (state.extractedChildNodes.length > 0) {
        stripBindingsOnlyReferencedByNodes(
          programPath.scope,
          state.extractedChildNodes,
          new Set<string>(),
          state.capturedNames,
        )
      }

      programPath.skip()
    },
  })

  if (!state.modified) return null

  return true
}

function loadHydrateVirtualModule(options: {
  id: string
  root: string
  code: string
  framework: CompileStartFrameworkOptions
}) {
  const { sourceId, splitId, boundaryIndex } = parseHydrateVirtualId(options.id)
  if (!splitId || boundaryIndex < 0) return null
  const getBoundaryId = createBoundaryId(options.root, sourceId)

  const ast = parseAst({ code: options.code, sourceFilename: sourceId })
  const hydrateImport = getHydrateImport(ast, options.framework)
  if (!hydrateImport) return null
  const { hydrateLocalName: localName } = hydrateImport

  let target: t.JSXElement | undefined
  let targetIndex = -1
  let targetCaptured: Array<string> = []
  let index = 0

  babel.traverse(ast, {
    JSXElement(path) {
      if (getJSXElementName(path.node) !== localName) return
      const split = getBooleanProp(path.node.openingElement, 'split')
      if (split === false) return

      if (index === boundaryIndex) {
        const id = getBoundaryId(index)
        if (id !== splitId) {
          path.stop()
          return
        }
        targetCaptured = inspectSplitBoundary({
          code: options.code,
          path,
          collectCaptured: true,
        }).captured
        target = t.cloneNode(path.node, true)
        targetIndex = index
        path.stop()
        return
      }
      index++
    },
  })

  if (!target || targetIndex < 0) return null

  const children = target.children
  const exportName = `H${targetIndex}`
  const refIdents = findReferencedIdentifiers(ast)

  removeModuleLevelBindings(ast, new Set(['Route']))
  const localBindings = new Set<string>()
  for (const node of ast.program.body) {
    collectLocalBindingsFromStatement(node, localBindings)
  }

  const keepBindings = new Set<string>()
  const meaningfulChildren = getMeaningfulChildren(children)
  let returnExpression: t.Expression | t.JSXElement | t.JSXFragment =
    t.nullLiteral()

  if (meaningfulChildren.length === 1) {
    const child = meaningfulChildren[0]!
    if (t.isJSXExpressionContainer(child)) {
      returnExpression = t.isJSXEmptyExpression(child.expression)
        ? t.nullLiteral()
        : child.expression
    } else if (t.isJSXElement(child) || t.isJSXFragment(child)) {
      returnExpression = child
    } else if (t.isJSXText(child)) {
      returnExpression = t.stringLiteral(child.value)
    }
  } else if (meaningfulChildren.length > 1) {
    returnExpression = t.jsxFragment(
      t.jsxOpeningFragment(),
      t.jsxClosingFragment(),
      children,
    )
  }
  for (const name of collectIdentifiersFromNode(returnExpression)) {
    if (localBindings.has(name)) {
      keepBindings.add(name)
    }
  }

  if (keepBindings.size > 0) {
    expandTransitively(
      keepBindings,
      buildDependencyGraph(buildDeclarationMap(ast), localBindings),
    )
  }

  retainModuleLevelDeclarations(ast, keepBindings)
  unwrapExportedDeclarations(ast)

  ast.program.body.push(
    t.exportNamedDeclaration(
      t.functionDeclaration(
        t.identifier(exportName),
        targetCaptured.length > 0
          ? [
              t.objectPattern(
                targetCaptured.map((name) =>
                  t.objectProperty(
                    t.identifier(name),
                    t.identifier(name),
                    false,
                    true,
                  ),
                ),
              ),
            ]
          : [],
        t.blockStatement([t.returnStatement(returnExpression)]),
      ),
    ),
  )

  deadCodeElimination(ast, refIdents)
  stripUnreferencedTopLevelExpressionStatements(ast)

  const result = generateFromAst(ast, {
    sourceMaps: true,
    sourceFileName: options.id,
    filename: options.id,
  })
  return result
}

export function createHydrateCompilerPlugin(): StartCompilerPlugin {
  type SourceEntry = {
    code: string
    framework: CompileStartFrameworkOptions
    virtualModules: Map<string, StartCompilerTransformResult | null>
  }

  const sourcesByEnvironment = new Map<string, Map<string, SourceEntry>>()

  const getEnvironmentSources = (envName: string) => {
    let sources = sourcesByEnvironment.get(envName)
    if (!sources) {
      sources = new Map()
      sourcesByEnvironment.set(envName, sources)
    }
    return sources
  }

  const setSource = (
    envName: string,
    id: string,
    code: string,
    framework: CompileStartFrameworkOptions,
  ) => {
    const sourceId = cleanId(id)
    const sources = getEnvironmentSources(envName)
    const existing = sources.get(sourceId)
    if (existing?.code === code && existing.framework === framework) {
      return existing
    }

    const entry = {
      code,
      framework,
      virtualModules: new Map<string, StartCompilerTransformResult | null>(),
    }
    sources.set(sourceId, entry)
    return entry
  }

  const getSourceEntry = (envName: string, id: string) =>
    sourcesByEnvironment.get(envName)?.get(cleanId(id))

  const deleteSource = (envName: string, id: string) => {
    sourcesByEnvironment.get(envName)?.delete(cleanId(id))
  }

  return {
    name: 'tanstack-start-core:hydrate',
    detect: HYDRATE_DETECTION_PATTERN,
    virtualModuleIdPattern: new RegExp(`[?&]${tssHydrate}=`),
    transformAst(context) {
      const virtualModule = parseHydrateVirtualId(context.id)
      const indexOffset =
        virtualModule.boundaryIndex < 0
          ? undefined
          : virtualModule.boundaryIndex + 1
      const result = transformHydrateAst({
        ast: context.ast,
        code: context.code,
        id: context.id,
        root: context.root,
        env: context.env,
        framework: context.framework,
        indexOffset,
      })

      if (result && virtualModule.boundaryIndex < 0) {
        setSource(context.envName, context.id, context.code, context.framework)
      }

      return !!result
    },
    loadVirtualModule(context) {
      const virtualModule = parseHydrateVirtualId(context.id)
      if (!virtualModule.splitId || virtualModule.boundaryIndex < 0) {
        return null
      }

      const existingSourceEntry = getSourceEntry(
        context.envName,
        virtualModule.sourceId,
      )
      const sourceEntry =
        context.code === undefined
          ? existingSourceEntry
          : setSource(
              context.envName,
              virtualModule.sourceId,
              context.code,
              existingSourceEntry?.framework ??
                (context.code.includes('@tanstack/solid-start')
                  ? 'solid'
                  : 'react'),
            )

      if (!sourceEntry) {
        throw new MissingHydrateSourceError(context.id)
      }

      if (sourceEntry.virtualModules.has(context.id)) {
        return sourceEntry.virtualModules.get(context.id)!
      }

      const result = loadHydrateVirtualModule({
        code: sourceEntry.code,
        id: context.id,
        root: context.root,
        framework: sourceEntry.framework,
      })
      sourceEntry.virtualModules.set(context.id, result)
      return result
    },
    invalidateModule(context) {
      deleteSource(context.envName, context.id)
    },
  }
}
