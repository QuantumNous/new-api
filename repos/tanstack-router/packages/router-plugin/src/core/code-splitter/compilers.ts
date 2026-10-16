import * as t from '@babel/types'
import * as babel from '@babel/core'
import * as template from '@babel/template'
import {
  buildDeclarationMap,
  buildDependencyGraph,
  collectIdentifiersFromPattern,
  collectLocalBindingsFromStatement,
  collectModuleLevelRefsFromNode,
  createIdentifier,
  deadCodeElimination,
  expandDestructuredDeclarations,
  expandSharedDestructuredDeclarators,
  expandTransitively,
  findReferencedIdentifiers,
  generateFromAst,
  parseAst,
  removeBindingsTransitivelyDependingOn,
  retainModuleLevelDeclarations,
  stripUnreferencedTopLevelExpressionStatements,
  unwrapExportedDeclarations,
} from '@tanstack/router-utils'
import { tsrShared, tsrSplit } from '../constants'
import { createRouteHmrStatement } from '../hmr'
import { getObjectPropertyKeyName } from '../utils'
import { getFrameworkOptions } from './framework-options'
import type {
  CompileCodeSplitReferenceRouteOptions,
  ReferenceRouteCompilerPlugin,
} from './plugins'
import type { GeneratorResult, ParseAstOptions } from '@tanstack/router-utils'
import type { CodeSplitGroupings, SplitRouteIdentNodes } from '../constants'
import type { SplitNodeMeta } from './types'

export {
  buildDeclarationMap,
  buildDependencyGraph,
  collectIdentifiersFromNode,
  collectLocalBindingsFromStatement,
  collectModuleLevelRefsFromNode,
  expandDestructuredDeclarations,
  expandSharedDestructuredDeclarators,
  expandTransitively,
  removeBindingsTransitivelyDependingOn,
} from '@tanstack/router-utils'

export function removeBindingsDependingOnRoute(
  bindings: Set<string>,
  dependencyGraph: Map<string, Set<string>>,
) {
  removeBindingsTransitivelyDependingOn(bindings, dependencyGraph, ['Route'])
}

const SPLIT_NODES_CONFIG = new Map<SplitRouteIdentNodes, SplitNodeMeta>([
  [
    'loader',
    {
      routeIdent: 'loader',
      localImporterIdent: '$$splitLoaderImporter', // const $$splitLoaderImporter = () => import('...')
      splitStrategy: 'lazyFn',
      localExporterIdent: 'SplitLoader', // const SplitLoader = ...
      exporterIdent: 'loader', // export { SplitLoader as loader }
    },
  ],
  [
    'component',
    {
      routeIdent: 'component',
      localImporterIdent: '$$splitComponentImporter', // const $$splitComponentImporter = () => import('...')
      splitStrategy: 'lazyRouteComponent',
      localExporterIdent: 'SplitComponent', // const SplitComponent = ...
      exporterIdent: 'component', // export { SplitComponent as component }
    },
  ],
  [
    'pendingComponent',
    {
      routeIdent: 'pendingComponent',
      localImporterIdent: '$$splitPendingComponentImporter', // const $$splitPendingComponentImporter = () => import('...')
      splitStrategy: 'lazyRouteComponent',
      localExporterIdent: 'SplitPendingComponent', // const SplitPendingComponent = ...
      exporterIdent: 'pendingComponent', // export { SplitPendingComponent as pendingComponent }
    },
  ],
  [
    'errorComponent',
    {
      routeIdent: 'errorComponent',
      localImporterIdent: '$$splitErrorComponentImporter', // const $$splitErrorComponentImporter = () => import('...')
      splitStrategy: 'lazyRouteComponent',
      localExporterIdent: 'SplitErrorComponent', // const SplitErrorComponent = ...
      exporterIdent: 'errorComponent', // export { SplitErrorComponent as errorComponent }
    },
  ],
  [
    'notFoundComponent',
    {
      routeIdent: 'notFoundComponent',
      localImporterIdent: '$$splitNotFoundComponentImporter', // const $$splitNotFoundComponentImporter = () => import('...')
      splitStrategy: 'lazyRouteComponent',
      localExporterIdent: 'SplitNotFoundComponent', // const SplitNotFoundComponent = ...
      exporterIdent: 'notFoundComponent', // export { SplitNotFoundComponent as notFoundComponent }
    },
  ],
])

const KNOWN_SPLIT_ROUTE_IDENTS = [...SPLIT_NODES_CONFIG.keys()] as const

function addSplitSearchParamToFilename(
  filename: string,
  grouping: Array<string>,
) {
  const [bareFilename] = filename.split('?')

  const params = new URLSearchParams()
  params.append(tsrSplit, createIdentifier(grouping))

  const result = `${bareFilename}?${params.toString()}`
  return result
}

function removeSplitSearchParamFromFilename(filename: string) {
  const [bareFilename] = filename.split('?')
  return bareFilename!
}

export function addSharedSearchParamToFilename(filename: string) {
  const [bareFilename] = filename.split('?')
  return `${bareFilename}?${tsrShared}=1`
}

const splittableCreateRouteFns = ['createFileRoute']
const unsplittableCreateRouteFns = [
  'createRootRoute',
  'createRootRouteWithContext',
]
const allCreateRouteFns = [
  ...splittableCreateRouteFns,
  ...unsplittableCreateRouteFns,
]

/**
 * Computes module-level bindings that are shared between split and non-split
 * route properties. These bindings need to be extracted into a shared virtual
 * module to avoid double-initialization.
 *
 * A binding is "shared" if it is referenced by at least one split property
 * AND at least one non-split property. Only locally-declared module-level
 * bindings are candidates (not imports — bundlers dedupe those).
 */
export function computeSharedBindings(opts: {
  code: string
  filename?: string
  codeSplitGroupings: CodeSplitGroupings
}): Set<string> {
  const ast = parseAst(opts)

  // Early bailout: collect all module-level locally-declared binding names.
  // This is a cheap loop over program.body (no traversal). If the file has
  // no local bindings (aside from `Route`), nothing can be shared — skip
  // the expensive babel.traverse entirely.
  const localModuleLevelBindings = new Set<string>()
  for (const node of ast.program.body) {
    collectLocalBindingsFromStatement(node, localModuleLevelBindings)
  }

  // File-based routes always export a route config binding (usually `Route`).
  // This must never be extracted into the shared module.
  localModuleLevelBindings.delete('Route')

  if (localModuleLevelBindings.size === 0) {
    return new Set()
  }

  function findIndexForSplitNode(str: string) {
    return opts.codeSplitGroupings.findIndex((group) =>
      group.includes(str as any),
    )
  }

  // Find the route options object — needs babel.traverse for scope resolution
  let routeOptions: t.ObjectExpression | undefined

  babel.traverse(ast, {
    CallExpression(path) {
      if (!t.isIdentifier(path.node.callee)) return
      if (!splittableCreateRouteFns.includes(path.node.callee.name)) return

      if (t.isCallExpression(path.parentPath.node)) {
        const opts = resolveIdentifier(path, path.parentPath.node.arguments[0])
        if (t.isObjectExpression(opts)) routeOptions = opts
      } else if (t.isVariableDeclarator(path.parentPath.node)) {
        const caller = resolveIdentifier(path, path.parentPath.node.init)
        if (t.isCallExpression(caller)) {
          const opts = resolveIdentifier(path, caller.arguments[0])
          if (t.isObjectExpression(opts)) routeOptions = opts
        }
      }
    },
  })

  if (!routeOptions) return new Set()

  // Fast path: if fewer than 2 distinct groups are referenced by route options,
  // nothing can be shared and we can skip the rest of the work.
  const splitGroupsPresent = new Set<number>()
  let hasNonSplit = false
  for (const prop of routeOptions.properties) {
    if (!t.isObjectProperty(prop)) continue
    const key = getObjectPropertyKeyName(prop)
    if (!key) continue
    if (key === 'codeSplitGroupings') continue
    if (t.isIdentifier(prop.value) && prop.value.name === 'undefined') continue
    const groupIndex = findIndexForSplitNode(key) // -1 if non-split
    if (groupIndex === -1) {
      hasNonSplit = true
    } else {
      splitGroupsPresent.add(groupIndex)
    }
  }

  if (!hasNonSplit && splitGroupsPresent.size < 2) return new Set()

  // Build dependency graph up front — needed for transitive expansion per-property.
  // This graph excludes `Route` (deleted above) so group attribution works correctly.
  const declMap = buildDeclarationMap(ast)
  const depGraph = buildDependencyGraph(declMap, localModuleLevelBindings)

  // Build a second dependency graph that includes `Route` so we can detect
  // bindings that transitively depend on it. Such bindings must NOT be
  // extracted into the shared module because they would drag the Route
  // singleton with them, duplicating it across modules.
  const allLocalBindings = new Set(localModuleLevelBindings)
  allLocalBindings.add('Route')
  const fullDepGraph = buildDependencyGraph(declMap, allLocalBindings)

  // For each route property, track which "group" it belongs to.
  // Non-split properties get group index -1.
  // Split properties get their codeSplitGroupings index (0, 1, ...).
  // A binding is "shared" if it appears in 2+ distinct groups.
  // We expand each property's refs transitively BEFORE comparing groups,
  // so indirect refs (e.g., component: MyComp where MyComp uses `shared`)
  // are correctly attributed.
  const refsByGroup = new Map<string, Set<number>>()

  for (const prop of routeOptions.properties) {
    if (!t.isObjectProperty(prop)) continue
    const key = getObjectPropertyKeyName(prop)
    if (!key) continue

    if (key === 'codeSplitGroupings') continue

    const groupIndex = findIndexForSplitNode(key) // -1 if non-split

    const directRefs = collectModuleLevelRefsFromNode(
      prop.value,
      localModuleLevelBindings,
    )

    // Expand transitively: if component references SharedComp which references
    // `shared`, then `shared` is also attributed to component's group.
    const allRefs = new Set(directRefs)
    expandTransitively(allRefs, depGraph)

    for (const ref of allRefs) {
      let groups = refsByGroup.get(ref)
      if (!groups) {
        groups = new Set()
        refsByGroup.set(ref, groups)
      }
      groups.add(groupIndex)
    }
  }

  // Shared = bindings appearing in 2+ distinct groups
  const shared = new Set<string>()
  for (const [name, groups] of refsByGroup) {
    if (groups.size >= 2) shared.add(name)
  }

  // Destructured declarators (e.g. `const { a, b } = fn()`) must be treated
  // as a single initialization unit. Even if each binding is referenced by
  // only one group, if *different* bindings from the same declarator are
  // referenced by different groups, the declarator must be extracted to the
  // shared module to avoid double initialization.
  expandSharedDestructuredDeclarators(ast, refsByGroup, shared)

  if (shared.size === 0) return shared

  // If any binding from a destructured declaration is shared,
  // all bindings from that declaration must be shared
  expandDestructuredDeclarations(ast, shared)

  // Remove shared bindings that transitively depend on `Route`.
  // The Route singleton must stay in the reference file; extracting a
  // binding that references it would duplicate Route in the shared module.
  removeBindingsTransitivelyDependingOn(shared, fullDepGraph, ['Route'])

  return shared
}

/**
 * Find which shared bindings are user-exported in the original source.
 * These need to be re-exported from the shared module.
 */
function findExportedSharedBindings(
  ast: t.File,
  sharedBindings: Set<string>,
): Set<string> {
  const exported = new Set<string>()
  for (const stmt of ast.program.body) {
    if (!t.isExportNamedDeclaration(stmt) || !stmt.declaration) continue

    if (t.isVariableDeclaration(stmt.declaration)) {
      for (const decl of stmt.declaration.declarations) {
        for (const name of collectIdentifiersFromPattern(decl.id)) {
          if (sharedBindings.has(name)) exported.add(name)
        }
      }
    } else if (
      t.isFunctionDeclaration(stmt.declaration) &&
      stmt.declaration.id
    ) {
      if (sharedBindings.has(stmt.declaration.id.name))
        exported.add(stmt.declaration.id.name)
    } else if (t.isClassDeclaration(stmt.declaration) && stmt.declaration.id) {
      if (sharedBindings.has(stmt.declaration.id.name))
        exported.add(stmt.declaration.id.name)
    }
  }
  return exported
}

/**
 * Remove declarations of shared bindings from the AST.
 * Handles both plain and exported declarations, including destructured patterns.
 * Removes the entire statement if all bindings in it are shared.
 */
function removeSharedDeclarations(ast: t.File, sharedBindings: Set<string>) {
  ast.program.body = ast.program.body.filter((stmt) => {
    const decl =
      t.isExportNamedDeclaration(stmt) && stmt.declaration
        ? stmt.declaration
        : stmt

    if (t.isVariableDeclaration(decl)) {
      // Filter out declarators where all bound names are shared
      decl.declarations = decl.declarations.filter((declarator) => {
        const names = collectIdentifiersFromPattern(declarator.id)
        return !names.every((n) => sharedBindings.has(n))
      })
      // If no declarators remain, remove the entire statement
      if (decl.declarations.length === 0) return false
    } else if (t.isFunctionDeclaration(decl) && decl.id) {
      if (sharedBindings.has(decl.id.name)) return false
    } else if (t.isClassDeclaration(decl) && decl.id) {
      if (sharedBindings.has(decl.id.name)) return false
    }

    return true
  })
}

export function compileCodeSplitReferenceRoute(
  opts: ParseAstOptions &
    CompileCodeSplitReferenceRouteOptions & {
      compilerPlugins?: Array<ReferenceRouteCompilerPlugin>
    },
): GeneratorResult | null {
  const ast = parseAst(opts)

  const refIdents = findReferencedIdentifiers(ast)

  const knownExportedIdents = new Set<string>()

  function findIndexForSplitNode(str: string) {
    return opts.codeSplitGroupings.findIndex((group) =>
      group.includes(str as any),
    )
  }

  const frameworkOptions = getFrameworkOptions(opts.targetFramework)
  const PACKAGE = frameworkOptions.package
  const LAZY_ROUTE_COMPONENT_IDENT = frameworkOptions.idents.lazyRouteComponent
  const LAZY_FN_IDENT = frameworkOptions.idents.lazyFn
  const stableRouteOptionKeys = [
    ...new Set(
      (opts.compilerPlugins ?? []).flatMap(
        (plugin) => plugin.getStableRouteOptionKeys?.() ?? [],
      ),
    ),
  ]

  let createRouteFn: string

  let modified = false as boolean
  let hmrAdded = false as boolean
  let sharedExportedNames: Set<string> | undefined
  babel.traverse(ast, {
    Program: {
      enter(programPath) {
        /**
         * If the component for the route is being imported from
         * another file, this is to track the path to that file
         * the path itself doesn't matter, we just need to keep
         * track of it so that we can remove it from the imports
         * list if it's not being used like:
         *
         * `import '../shared/imported'`
         */
        const removableImportPaths = new Set<string>([])

        programPath.traverse({
          CallExpression: (path) => {
            if (!t.isIdentifier(path.node.callee)) {
              return
            }

            if (!allCreateRouteFns.includes(path.node.callee.name)) {
              return
            }

            createRouteFn = path.node.callee.name

            function babelHandleReference(routeOptions: t.Node | undefined) {
              const hasImportedOrDefinedIdentifier = (name: string) => {
                return programPath.scope.hasBinding(name)
              }

              const addRouteHmr = (
                insertionPath: babel.NodePath,
                routeOptions: t.ObjectExpression,
              ) => {
                if (!opts.addHmr || hmrAdded) {
                  return
                }

                opts.compilerPlugins?.forEach((plugin) => {
                  const pluginResult = plugin.onAddHmr?.({
                    programPath,
                    callExpressionPath: path,
                    insertionPath,
                    routeOptions,
                    createRouteFn,
                    opts: opts as CompileCodeSplitReferenceRouteOptions,
                  })

                  if (pluginResult?.modified) {
                    modified = true
                  }
                })

                programPath.pushContainer(
                  'body',
                  createRouteHmrStatement(stableRouteOptionKeys, {
                    hmrStyle: opts.hmrStyle ?? 'vite',
                    targetFramework: opts.targetFramework,
                    routeId: opts.hmrRouteId,
                  }),
                )
                modified = true
                hmrAdded = true
              }

              if (t.isObjectExpression(routeOptions)) {
                const insertionPath = path.getStatementParent() ?? path

                opts.compilerPlugins?.forEach((plugin) => {
                  const pluginResult = plugin.onRouteOptions?.({
                    programPath,
                    callExpressionPath: path,
                    insertionPath,
                    routeOptions,
                    createRouteFn,
                    opts: opts as CompileCodeSplitReferenceRouteOptions,
                  })

                  if (pluginResult?.modified) {
                    modified = true
                  }
                })

                if (opts.deleteNodes && opts.deleteNodes.size > 0) {
                  routeOptions.properties = routeOptions.properties.filter(
                    (prop) => {
                      if (t.isObjectProperty(prop)) {
                        const key = getObjectPropertyKeyName(prop)
                        if (key && opts.deleteNodes!.has(key as any)) {
                          modified = true
                          return false
                        }
                      }
                      return true
                    },
                  )
                }
                if (!splittableCreateRouteFns.includes(createRouteFn)) {
                  opts.compilerPlugins?.forEach((plugin) => {
                    const pluginResult = plugin.onUnsplittableRoute?.({
                      programPath,
                      callExpressionPath: path,
                      insertionPath,
                      routeOptions,
                      createRouteFn,
                      opts: opts as CompileCodeSplitReferenceRouteOptions,
                    })

                    if (pluginResult?.modified) {
                      modified = true
                    }
                  })

                  // we can't split this route but we still add HMR handling if enabled
                  addRouteHmr(insertionPath, routeOptions)
                  // exit traversal so this route is not split
                  return programPath.stop()
                }
                routeOptions.properties.forEach((prop) => {
                  if (t.isObjectProperty(prop)) {
                    const key = getObjectPropertyKeyName(prop)

                    if (key) {
                      // If the user has not specified a split grouping for this key
                      // then we should not split it
                      const codeSplitGroupingByKey = findIndexForSplitNode(key)
                      if (codeSplitGroupingByKey === -1) {
                        return
                      }
                      const codeSplitGroup = [
                        ...new Set(
                          opts.codeSplitGroupings[codeSplitGroupingByKey],
                        ),
                      ]

                      // find key in nodeSplitConfig
                      const isNodeConfigAvailable = SPLIT_NODES_CONFIG.has(
                        key as any,
                      )

                      if (!isNodeConfigAvailable) {
                        return
                      }

                      // Exit early if the value is a boolean, null, or undefined.
                      // These values mean "don't use this component, fallback to parent"
                      // No code splitting needed to preserve fallback behavior
                      if (
                        t.isBooleanLiteral(prop.value) ||
                        t.isNullLiteral(prop.value) ||
                        (t.isIdentifier(prop.value) &&
                          prop.value.name === 'undefined')
                      ) {
                        return
                      }

                      const splitNodeMeta = SPLIT_NODES_CONFIG.get(key as any)!

                      // We need to extract the existing search params from the filename, if any
                      // and add the relevant codesplitPrefix to them, then write them back to the filename
                      const splitUrl = addSplitSearchParamToFilename(
                        opts.filename,
                        codeSplitGroup,
                      )

                      if (
                        splitNodeMeta.splitStrategy === 'lazyRouteComponent'
                      ) {
                        const value = prop.value

                        let shouldSplit = true

                        if (t.isIdentifier(value)) {
                          const existingImportPath =
                            getImportSpecifierAndPathFromLocalName(
                              programPath,
                              value.name,
                            ).path
                          if (existingImportPath) {
                            removableImportPaths.add(existingImportPath)
                          }

                          // exported identifiers should not be split
                          // since they are already being imported
                          // and need to be retained in the compiled file
                          const isExported = hasExport(ast, value)
                          if (isExported) {
                            knownExportedIdents.add(value.name)
                          }
                          shouldSplit = !isExported

                          if (shouldSplit) {
                            removeIdentifierLiteral(path, value)
                          }
                        }

                        if (!shouldSplit) {
                          return
                        }

                        modified = true

                        // Prepend the import statement to the program along with the importer function
                        // Check to see if lazyRouteComponent is already imported before attempting
                        // to import it again
                        if (
                          !hasImportedOrDefinedIdentifier(
                            LAZY_ROUTE_COMPONENT_IDENT,
                          )
                        ) {
                          programPath.unshiftContainer('body', [
                            template.statement(
                              `import { ${LAZY_ROUTE_COMPONENT_IDENT} } from '${PACKAGE}'`,
                            )(),
                          ])
                        }

                        // Check to see if the importer function is already defined
                        // If not, define it with the dynamic import statement
                        if (
                          !hasImportedOrDefinedIdentifier(
                            splitNodeMeta.localImporterIdent,
                          )
                        ) {
                          programPath.unshiftContainer('body', [
                            template.statement(
                              `const ${splitNodeMeta.localImporterIdent} = () => import('${splitUrl}')`,
                            )(),
                          ])
                        }

                        const insertionPath = path.getStatementParent() ?? path
                        let splitPropValue: t.Expression | undefined

                        for (const plugin of opts.compilerPlugins ?? []) {
                          const pluginPropValue = plugin.onSplitRouteProperty?.(
                            {
                              programPath,
                              callExpressionPath: path,
                              insertionPath,
                              routeOptions,
                              prop,
                              splitNodeMeta,
                              lazyRouteComponentIdent:
                                LAZY_ROUTE_COMPONENT_IDENT,
                              opts,
                            },
                          )

                          if (!pluginPropValue) {
                            continue
                          }

                          modified = true
                          splitPropValue = pluginPropValue
                          break
                        }

                        if (splitPropValue) {
                          prop.value = splitPropValue
                        } else {
                          prop.value = template.expression(
                            `${LAZY_ROUTE_COMPONENT_IDENT}(${splitNodeMeta.localImporterIdent}, '${splitNodeMeta.exporterIdent}')`,
                          )()
                        }

                        // add HMR handling
                        addRouteHmr(insertionPath, routeOptions)
                      } else {
                        // if (splitNodeMeta.splitStrategy === 'lazyFn') {
                        const value = prop.value

                        let shouldSplit = true

                        if (t.isIdentifier(value)) {
                          const existingImportPath =
                            getImportSpecifierAndPathFromLocalName(
                              programPath,
                              value.name,
                            ).path
                          if (existingImportPath) {
                            removableImportPaths.add(existingImportPath)
                          }

                          // exported identifiers should not be split
                          // since they are already being imported
                          // and need to be retained in the compiled file
                          const isExported = hasExport(ast, value)
                          if (isExported) {
                            knownExportedIdents.add(value.name)
                          }
                          shouldSplit = !isExported

                          if (shouldSplit) {
                            removeIdentifierLiteral(path, value)
                          }
                        }

                        if (!shouldSplit) {
                          return
                        }
                        modified = true

                        // Prepend the import statement to the program along with the importer function
                        if (!hasImportedOrDefinedIdentifier(LAZY_FN_IDENT)) {
                          programPath.unshiftContainer(
                            'body',
                            template.smart(
                              `import { ${LAZY_FN_IDENT} } from '${PACKAGE}'`,
                            )(),
                          )
                        }

                        // Check to see if the importer function is already defined
                        // If not, define it with the dynamic import statement
                        if (
                          !hasImportedOrDefinedIdentifier(
                            splitNodeMeta.localImporterIdent,
                          )
                        ) {
                          programPath.unshiftContainer('body', [
                            template.statement(
                              `const ${splitNodeMeta.localImporterIdent} = () => import('${splitUrl}')`,
                            )(),
                          ])
                        }

                        // Add the lazyFn call with the dynamic import to the prop value
                        prop.value = template.expression(
                          `${LAZY_FN_IDENT}(${splitNodeMeta.localImporterIdent}, '${splitNodeMeta.exporterIdent}')`,
                        )()
                      }
                    }
                  }

                  programPath.scope.crawl()
                })

                addRouteHmr(insertionPath, routeOptions)
              }
            }

            if (t.isCallExpression(path.parentPath.node)) {
              // createFileRoute('/')({ ... })
              const options = resolveIdentifier(
                path,
                path.parentPath.node.arguments[0],
              )

              babelHandleReference(options)
            } else if (t.isVariableDeclarator(path.parentPath.node)) {
              // createFileRoute({ ... })
              const caller = resolveIdentifier(path, path.parentPath.node.init)

              if (t.isCallExpression(caller)) {
                const options = resolveIdentifier(path, caller.arguments[0])
                babelHandleReference(options)
              }
            }
          },
        })

        /**
         * If the component for the route is being imported,
         * and it's not being used, remove the import statement
         * from the program, by checking that the import has no
         * specifiers
         */
        if (removableImportPaths.size > 0) {
          modified = true
          programPath.traverse({
            ImportDeclaration(path) {
              if (path.node.specifiers.length > 0) return
              if (removableImportPaths.has(path.node.source.value)) {
                path.remove()
              }
            },
          })
        }

        // Handle shared bindings inside the Program visitor so we have
        // access to programPath for cheap refIdents registration.
        if (opts.sharedBindings && opts.sharedBindings.size > 0) {
          sharedExportedNames = findExportedSharedBindings(
            ast,
            opts.sharedBindings,
          )
          removeSharedDeclarations(ast, opts.sharedBindings)

          const sharedModuleUrl = addSharedSearchParamToFilename(opts.filename)

          const sharedImportSpecifiers = [...opts.sharedBindings].map((name) =>
            t.importSpecifier(t.identifier(name), t.identifier(name)),
          )
          const [sharedImportPath] = programPath.unshiftContainer(
            'body',
            t.importDeclaration(
              sharedImportSpecifiers,
              t.stringLiteral(sharedModuleUrl),
            ),
          )

          // Register import specifier locals in refIdents so DCE can remove unused ones
          sharedImportPath.traverse({
            Identifier(identPath) {
              if (
                identPath.parentPath.isImportSpecifier() &&
                identPath.key === 'local'
              ) {
                refIdents.add(identPath)
              }
            },
          })

          // Re-export user-exported shared bindings from the shared module
          if (sharedExportedNames.size > 0) {
            const reExportSpecifiers = [...sharedExportedNames].map((name) =>
              t.exportSpecifier(t.identifier(name), t.identifier(name)),
            )
            programPath.pushContainer(
              'body',
              t.exportNamedDeclaration(
                null,
                reExportSpecifiers,
                t.stringLiteral(sharedModuleUrl),
              ),
            )
          }
        }
      },
    },
  })

  if (!modified) {
    return null
  }

  deadCodeElimination(ast, refIdents)

  // if there are exported identifiers, then we need to add a warning
  // to the file to let the user know that the exported identifiers
  // will not in the split file but in the original file, therefore
  // increasing the bundle size
  if (knownExportedIdents.size > 0) {
    const warningMessage = createNotExportableMessage(
      opts.filename,
      knownExportedIdents,
    )
    console.warn(warningMessage)

    // append this warning to the file using a template
    if (process.env.NODE_ENV !== 'production') {
      const warningTemplate = template.statement(
        `console.warn(${JSON.stringify(warningMessage)})`,
      )()
      ast.program.body.unshift(warningTemplate)
    }
  }

  const result = generateFromAst(ast, {
    sourceMaps: true,
    sourceFileName: opts.filename,
    filename: opts.filename,
  })

  // @babel/generator does not populate sourcesContent because it only has
  // the AST, not the original text.  Without this, Vite's composed
  // sourcemap omits the original source, causing downstream consumers
  // (e.g. import-protection snippet display) to fall back to the shorter
  // compiled output and fail to resolve original line numbers.
  if (result.map) {
    result.map.sourcesContent = [opts.code]
  }

  return result
}

export function compileCodeSplitVirtualRoute(
  opts: ParseAstOptions & {
    splitTargets: Array<SplitRouteIdentNodes>
    filename: string
    sharedBindings?: Set<string>
  },
): GeneratorResult {
  const ast = parseAst(opts)
  const refIdents = findReferencedIdentifiers(ast)

  // Remove shared declarations BEFORE babel.traverse so the scope never sees
  // conflicting bindings (avoids checkBlockScopedCollisions crash in DCE)
  if (opts.sharedBindings && opts.sharedBindings.size > 0) {
    removeSharedDeclarations(ast, opts.sharedBindings)
  }

  const intendedSplitNodes = new Set(opts.splitTargets)

  const knownExportedIdents = new Set<string>()

  babel.traverse(ast, {
    Program: {
      enter(programPath) {
        const trackedNodesToSplitByType: Record<
          SplitRouteIdentNodes,
          { node: t.Node | undefined; meta: SplitNodeMeta } | undefined
        > = {
          component: undefined,
          loader: undefined,
          pendingComponent: undefined,
          errorComponent: undefined,
          notFoundComponent: undefined,
        }

        // Find and track all the known split-able nodes
        programPath.traverse({
          CallExpression: (path) => {
            if (!t.isIdentifier(path.node.callee)) {
              return
            }

            if (!splittableCreateRouteFns.includes(path.node.callee.name)) {
              return
            }

            function babelHandleVirtual(options: t.Node | undefined) {
              if (t.isObjectExpression(options)) {
                options.properties.forEach((prop) => {
                  if (t.isObjectProperty(prop)) {
                    // do not use `intendedSplitNodes` here
                    // since we have special considerations that need
                    // to be accounted for like (not splitting exported identifiers)
                    KNOWN_SPLIT_ROUTE_IDENTS.forEach((splitType) => {
                      if (getObjectPropertyKeyName(prop) !== splitType) {
                        return
                      }

                      const value = prop.value

                      // If the value for the `key` is `undefined`, then we don't need to include it
                      // in the split file, so we can just return, since it will kept in-place in the
                      // reference file
                      // This is useful for cases like: `createFileRoute('/')({ component: undefined })`
                      if (t.isIdentifier(value) && value.name === 'undefined') {
                        return
                      }

                      let isExported = false
                      if (t.isIdentifier(value)) {
                        isExported = hasExport(ast, value)
                        if (isExported) {
                          knownExportedIdents.add(value.name)
                        }
                      }

                      // If the node is exported, we need to remove
                      // the export from the split file
                      if (isExported && t.isIdentifier(value)) {
                        removeExports(ast, value)
                      } else {
                        const meta = SPLIT_NODES_CONFIG.get(splitType)!
                        trackedNodesToSplitByType[splitType] = {
                          node: prop.value,
                          meta,
                        }
                      }
                    })
                  }
                })

                // Remove all of the options
                options.properties = []
              }
            }

            if (t.isCallExpression(path.parentPath.node)) {
              // createFileRoute('/')({ ... })
              const options = resolveIdentifier(
                path,
                path.parentPath.node.arguments[0],
              )

              babelHandleVirtual(options)
            } else if (t.isVariableDeclarator(path.parentPath.node)) {
              // createFileRoute({ ... })
              const caller = resolveIdentifier(path, path.parentPath.node.init)

              if (t.isCallExpression(caller)) {
                const options = resolveIdentifier(path, caller.arguments[0])
                babelHandleVirtual(options)
              }
            }
          },
        })

        // Start the transformation to only exported the intended split nodes
        intendedSplitNodes.forEach((SPLIT_TYPE) => {
          const splitKey = trackedNodesToSplitByType[SPLIT_TYPE]

          if (!splitKey) {
            return
          }

          let splitNode = splitKey.node
          const splitMeta = { ...splitKey.meta, shouldRemoveNode: true }

          // Track the original identifier name before resolving through bindings,
          // needed for destructured patterns where the binding resolves to the
          // entire VariableDeclarator (ObjectPattern) rather than the specific binding
          let originalIdentName: string | undefined
          if (t.isIdentifier(splitNode)) {
            originalIdentName = splitNode.name
          }

          while (t.isIdentifier(splitNode)) {
            const binding = programPath.scope.getBinding(splitNode.name)
            splitNode = binding?.path.node
          }

          // Add the node to the program
          if (splitNode) {
            if (t.isFunctionDeclaration(splitNode)) {
              // an anonymous function declaration should only happen for `export default function() {...}`
              // so we should never get here
              if (!splitNode.id) {
                throw new Error(
                  `Function declaration for "${SPLIT_TYPE}" must have an identifier.`,
                )
              }
              splitMeta.shouldRemoveNode = false
              splitMeta.localExporterIdent = splitNode.id.name
            } else if (
              t.isFunctionExpression(splitNode) ||
              t.isArrowFunctionExpression(splitNode)
            ) {
              programPath.pushContainer(
                'body',
                t.variableDeclaration('const', [
                  t.variableDeclarator(
                    t.identifier(splitMeta.localExporterIdent),
                    splitNode,
                  ),
                ]),
              )
            } else if (
              t.isImportSpecifier(splitNode) ||
              t.isImportDefaultSpecifier(splitNode)
            ) {
              programPath.pushContainer(
                'body',
                t.variableDeclaration('const', [
                  t.variableDeclarator(
                    t.identifier(splitMeta.localExporterIdent),
                    splitNode.local,
                  ),
                ]),
              )
            } else if (t.isVariableDeclarator(splitNode)) {
              if (t.isIdentifier(splitNode.id)) {
                splitMeta.localExporterIdent = splitNode.id.name
                splitMeta.shouldRemoveNode = false
              } else if (t.isObjectPattern(splitNode.id)) {
                // Destructured binding like `const { component: MyComp } = createBits()`
                // Use the original identifier name that was tracked before resolving
                if (originalIdentName) {
                  splitMeta.localExporterIdent = originalIdentName
                }
                splitMeta.shouldRemoveNode = false
              } else {
                throw new Error(
                  `Unexpected splitNode type ☝️: ${splitNode.type}`,
                )
              }
            } else if (t.isCallExpression(splitNode)) {
              const outputSplitNodeCode = generateFromAst(splitNode).code
              const splitNodeAst = babel.parse(outputSplitNodeCode)

              if (!splitNodeAst) {
                throw new Error(
                  `Failed to parse the generated code for "${SPLIT_TYPE}" in the node type "${splitNode.type}"`,
                )
              }

              const statement = splitNodeAst.program.body[0]

              if (!statement) {
                throw new Error(
                  `Failed to parse the generated code for "${SPLIT_TYPE}" in the node type "${splitNode.type}" as no statement was found in the program body`,
                )
              }

              if (t.isExpressionStatement(statement)) {
                const expression = statement.expression
                programPath.pushContainer(
                  'body',
                  t.variableDeclaration('const', [
                    t.variableDeclarator(
                      t.identifier(splitMeta.localExporterIdent),
                      expression,
                    ),
                  ]),
                )
              } else {
                throw new Error(
                  `Unexpected expression type encounter for "${SPLIT_TYPE}" in the node type "${splitNode.type}"`,
                )
              }
            } else if (t.isConditionalExpression(splitNode)) {
              programPath.pushContainer(
                'body',
                t.variableDeclaration('const', [
                  t.variableDeclarator(
                    t.identifier(splitMeta.localExporterIdent),
                    splitNode,
                  ),
                ]),
              )
            } else if (t.isTSAsExpression(splitNode)) {
              // remove the type assertion
              splitNode = splitNode.expression
              programPath.pushContainer(
                'body',
                t.variableDeclaration('const', [
                  t.variableDeclarator(
                    t.identifier(splitMeta.localExporterIdent),
                    splitNode,
                  ),
                ]),
              )
            } else if (t.isBooleanLiteral(splitNode)) {
              // Handle boolean literals
              // This exits early here, since this value will be kept in the reference file
              return
            } else if (t.isNullLiteral(splitNode)) {
              // Handle null literals
              // This exits early here, since this value will be kept in the reference file
              return
            } else {
              console.info('Unexpected splitNode type:', splitNode)
              throw new Error(`Unexpected splitNode type ☝️: ${splitNode.type}`)
            }
          }

          if (splitMeta.shouldRemoveNode) {
            // If the splitNode exists at the top of the program
            // then we need to remove that copy
            programPath.node.body = programPath.node.body.filter((node) => {
              return node !== splitNode
            })
          }

          // Export the node
          programPath.pushContainer('body', [
            t.exportNamedDeclaration(null, [
              t.exportSpecifier(
                t.identifier(splitMeta.localExporterIdent), // local variable name
                t.identifier(splitMeta.exporterIdent), // as what name it should be exported as
              ),
            ]),
          ])
        })

        // convert exports to imports from the original file
        programPath.traverse({
          ExportNamedDeclaration(path) {
            // e.g. export const x = 1 or export { x }
            // becomes
            // import { x } from '${opts.id}'

            if (path.node.declaration) {
              if (t.isVariableDeclaration(path.node.declaration)) {
                const specifiers = path.node.declaration.declarations.flatMap(
                  (decl) => {
                    if (t.isIdentifier(decl.id)) {
                      return [
                        t.importSpecifier(
                          t.identifier(decl.id.name),
                          t.identifier(decl.id.name),
                        ),
                      ]
                    }

                    if (t.isObjectPattern(decl.id)) {
                      return collectIdentifiersFromPattern(decl.id).map(
                        (name) =>
                          t.importSpecifier(
                            t.identifier(name),
                            t.identifier(name),
                          ),
                      )
                    }

                    if (t.isArrayPattern(decl.id)) {
                      return collectIdentifiersFromPattern(decl.id).map(
                        (name) =>
                          t.importSpecifier(
                            t.identifier(name),
                            t.identifier(name),
                          ),
                      )
                    }

                    return []
                  },
                )

                if (specifiers.length === 0) {
                  path.remove()
                  return
                }

                const importDecl = t.importDeclaration(
                  specifiers,
                  t.stringLiteral(
                    removeSplitSearchParamFromFilename(opts.filename),
                  ),
                )

                path.replaceWith(importDecl)

                // Track the imported identifier paths so deadCodeElimination can remove them if unused
                // We need to traverse the newly created import to get the identifier paths
                path.traverse({
                  Identifier(identPath) {
                    // Only track the local binding identifiers (the imported names)
                    if (
                      identPath.parentPath.isImportSpecifier() &&
                      identPath.key === 'local'
                    ) {
                      refIdents.add(identPath)
                    }
                  },
                })
              }
            }
          },
        })

        // Add shared bindings import, registering specifiers in refIdents
        // so DCE can remove unused ones (same pattern as import replacements above).
        if (opts.sharedBindings && opts.sharedBindings.size > 0) {
          const sharedImportSpecifiers = [...opts.sharedBindings].map((name) =>
            t.importSpecifier(t.identifier(name), t.identifier(name)),
          )
          const sharedModuleUrl = addSharedSearchParamToFilename(
            removeSplitSearchParamFromFilename(opts.filename),
          )
          const [sharedImportPath] = programPath.unshiftContainer(
            'body',
            t.importDeclaration(
              sharedImportSpecifiers,
              t.stringLiteral(sharedModuleUrl),
            ),
          )

          sharedImportPath.traverse({
            Identifier(identPath) {
              if (
                identPath.parentPath.isImportSpecifier() &&
                identPath.key === 'local'
              ) {
                refIdents.add(identPath)
              }
            },
          })
        }
      },
    },
  })

  deadCodeElimination(ast, refIdents)
  stripUnreferencedTopLevelExpressionStatements(ast)

  // If the body is empty after DCE, strip directive prologues too.
  // A file containing only `'use client'` with no real code is useless.
  if (ast.program.body.length === 0) {
    ast.program.directives = []
  }

  const result = generateFromAst(ast, {
    sourceMaps: true,
    sourceFileName: opts.filename,
    filename: opts.filename,
  })

  // @babel/generator does not populate sourcesContent — see compileCodeSplitReferenceRoute.
  if (result.map) {
    result.map.sourcesContent = [opts.code]
  }

  return result
}

/**
 * Compile the shared virtual module (`?tsr-shared=1`).
 * Keeps only shared binding declarations, their transitive dependencies,
 * and imports they need. Exports all shared bindings.
 */
export function compileCodeSplitSharedRoute(
  opts: ParseAstOptions & {
    sharedBindings: Set<string>
    filename: string
  },
): GeneratorResult {
  const ast = parseAst(opts)
  const refIdents = findReferencedIdentifiers(ast)

  // Collect all names that need to stay: shared bindings + their transitive deps
  const localBindings = new Set<string>()
  for (const node of ast.program.body) {
    collectLocalBindingsFromStatement(node, localBindings)
  }

  // Route must never be extracted into the shared module.
  // Excluding it from the dep graph prevents expandTransitively from
  // pulling it in as a transitive dependency of a shared binding.
  localBindings.delete('Route')

  const declMap = buildDeclarationMap(ast)
  const depGraph = buildDependencyGraph(declMap, localBindings)

  // Start with shared bindings and expand transitively
  const keepBindings = new Set(opts.sharedBindings)
  keepBindings.delete('Route')
  expandTransitively(keepBindings, depGraph)

  retainModuleLevelDeclarations(ast, keepBindings)
  unwrapExportedDeclarations(ast)

  // Export all shared bindings (sorted for deterministic output)
  const exportNames = [...opts.sharedBindings].sort((a, b) =>
    a.localeCompare(b),
  )
  const exportSpecifiers = exportNames.map((name) =>
    t.exportSpecifier(t.identifier(name), t.identifier(name)),
  )
  if (exportSpecifiers.length > 0) {
    const exportDecl = t.exportNamedDeclaration(null, exportSpecifiers)
    ast.program.body.push(exportDecl)

    // Register export specifier locals in refIdents so DCE doesn't treat
    // the exported bindings as unreferenced.
    babel.traverse(ast, {
      Program(programPath) {
        const bodyPaths = programPath.get('body')
        const last = bodyPaths[bodyPaths.length - 1]
        if (last && last.isExportNamedDeclaration()) {
          last.traverse({
            Identifier(identPath) {
              if (
                identPath.parentPath.isExportSpecifier() &&
                identPath.key === 'local'
              ) {
                refIdents.add(identPath)
              }
            },
          })
        }
        programPath.stop()
      },
    })
  }

  deadCodeElimination(ast, refIdents)

  // If the body is empty after DCE, strip directive prologues too.
  if (ast.program.body.length === 0) {
    ast.program.directives = []
  }

  const result = generateFromAst(ast, {
    sourceMaps: true,
    sourceFileName: opts.filename,
    filename: opts.filename,
  })

  // @babel/generator does not populate sourcesContent — see compileCodeSplitReferenceRoute.
  if (result.map) {
    result.map.sourcesContent = [opts.code]
  }

  return result
}

/**
 * This function should read get the options from by searching for the key `codeSplitGroupings`
 * on createFileRoute and return it's values if it exists, else return undefined
 */
export function detectCodeSplitGroupingsFromRoute(opts: ParseAstOptions): {
  groupings: CodeSplitGroupings | undefined
} {
  const ast = parseAst(opts)

  let codeSplitGroupings: CodeSplitGroupings | undefined = undefined

  babel.traverse(ast, {
    Program: {
      enter(programPath) {
        programPath.traverse({
          CallExpression(path) {
            if (!t.isIdentifier(path.node.callee)) {
              return
            }

            if (
              !(
                path.node.callee.name === 'createRoute' ||
                path.node.callee.name === 'createFileRoute'
              )
            ) {
              return
            }

            function babelHandleSplittingGroups(
              routeOptions: t.Node | undefined,
            ) {
              if (t.isObjectExpression(routeOptions)) {
                routeOptions.properties.forEach((prop) => {
                  if (t.isObjectProperty(prop)) {
                    const key = getObjectPropertyKeyName(prop)
                    if (key === 'codeSplitGroupings') {
                      const value = prop.value

                      if (t.isArrayExpression(value)) {
                        codeSplitGroupings = value.elements.map((group) => {
                          if (t.isArrayExpression(group)) {
                            return group.elements.map((node) => {
                              if (!t.isStringLiteral(node)) {
                                throw new Error(
                                  'You must provide a string literal for the codeSplitGroupings',
                                )
                              }

                              return node.value
                            }) as Array<SplitRouteIdentNodes>
                          }

                          throw new Error(
                            'You must provide arrays with codeSplitGroupings options.',
                          )
                        })
                      } else {
                        throw new Error(
                          'You must provide an array of arrays for the codeSplitGroupings.',
                        )
                      }
                    }
                  }
                })
              }
            }

            // Extracting the codeSplitGroupings
            if (t.isCallExpression(path.parentPath.node)) {
              // createFileRoute('/')({ ... })
              const options = resolveIdentifier(
                path,
                path.parentPath.node.arguments[0],
              )

              babelHandleSplittingGroups(options)
            } else if (t.isVariableDeclarator(path.parentPath.node)) {
              // createFileRoute({ ... })
              const caller = resolveIdentifier(path, path.parentPath.node.init)

              if (t.isCallExpression(caller)) {
                const options = resolveIdentifier(path, caller.arguments[0])
                babelHandleSplittingGroups(options)
              }
            }
          },
        })
      },
    },
  })

  return { groupings: codeSplitGroupings }
}

function createNotExportableMessage(
  filename: string,
  idents: Set<string>,
): string {
  const list = Array.from(idents).map((d) => `- ${d}`)

  const message = [
    `[tanstack-router] These exports from "${filename}" will not be code-split and will increase your bundle size:`,
    ...list,
    'For the best optimization, these items should either have their export statements removed, or be imported from another location that is not a route file.',
  ].join('\n')

  return message
}

function getImportSpecifierAndPathFromLocalName(
  programPath: babel.NodePath<t.Program>,
  name: string,
): {
  specifier:
    | t.ImportSpecifier
    | t.ImportDefaultSpecifier
    | t.ImportNamespaceSpecifier
    | null
  path: string | null
} {
  let specifier:
    | t.ImportSpecifier
    | t.ImportDefaultSpecifier
    | t.ImportNamespaceSpecifier
    | null = null
  let path: string | null = null

  programPath.traverse({
    ImportDeclaration(importPath) {
      const found = importPath.node.specifiers.find(
        (targetSpecifier) => targetSpecifier.local.name === name,
      )
      if (found) {
        specifier = found
        path = importPath.node.source.value
      }
    },
  })

  return { specifier, path }
}

// Reusable function to get literal value or resolve variable to literal
function resolveIdentifier(path: any, node: any): t.Node | undefined {
  if (t.isIdentifier(node)) {
    const binding = path.scope.getBinding(node.name)
    if (
      binding
      // && binding.kind === 'const'
    ) {
      const declarator = binding.path.node
      if (t.isObjectExpression(declarator.init)) {
        return declarator.init
      } else if (t.isFunctionDeclaration(declarator.init)) {
        return declarator.init
      }
    }
    return undefined
  }

  return node
}

function removeIdentifierLiteral(path: babel.NodePath, node: t.Identifier) {
  const binding = path.scope.getBinding(node.name)
  if (binding) {
    // If the binding is a destructured property from an ObjectPattern,
    // only remove that property instead of the entire declaration
    if (
      t.isVariableDeclarator(binding.path.node) &&
      t.isObjectPattern(binding.path.node.id)
    ) {
      const objectPattern = binding.path.node.id
      objectPattern.properties = objectPattern.properties.filter((prop) => {
        if (!t.isObjectProperty(prop)) {
          return true
        }

        if (t.isIdentifier(prop.value) && prop.value.name === node.name) {
          return false
        }

        if (
          t.isAssignmentPattern(prop.value) &&
          t.isIdentifier(prop.value.left) &&
          prop.value.left.name === node.name
        ) {
          return false
        }

        return true
      })

      // If no properties remain, remove the entire declaration
      if (objectPattern.properties.length === 0) {
        binding.path.remove()
      }

      return
    }

    binding.path.remove()
  }
}

function hasExport(ast: t.File, node: t.Identifier): boolean {
  let found = false

  babel.traverse(ast, {
    ExportNamedDeclaration(path) {
      if (path.node.declaration) {
        // declared as `const loaderFn = () => {}`
        if (t.isVariableDeclaration(path.node.declaration)) {
          path.node.declaration.declarations.forEach((decl) => {
            if (t.isVariableDeclarator(decl)) {
              if (t.isIdentifier(decl.id)) {
                if (decl.id.name === node.name) {
                  found = true
                }
              } else if (
                t.isObjectPattern(decl.id) ||
                t.isArrayPattern(decl.id)
              ) {
                // Handle destructured exports like `export const { a, b } = fn()`
                const names = collectIdentifiersFromPattern(decl.id)
                if (names.includes(node.name)) {
                  found = true
                }
              }
            }
          })
        }

        // declared as `function loaderFn() {}`
        if (t.isFunctionDeclaration(path.node.declaration)) {
          if (t.isIdentifier(path.node.declaration.id)) {
            if (path.node.declaration.id.name === node.name) {
              found = true
            }
          }
        }
      }
    },
    ExportDefaultDeclaration(path) {
      // declared as `export default loaderFn`
      if (t.isIdentifier(path.node.declaration)) {
        if (path.node.declaration.name === node.name) {
          found = true
        }
      }

      // declared as `export default function loaderFn() {}`
      if (t.isFunctionDeclaration(path.node.declaration)) {
        if (t.isIdentifier(path.node.declaration.id)) {
          if (path.node.declaration.id.name === node.name) {
            found = true
          }
        }
      }
    },
  })

  return found
}

function removeExports(ast: t.File, node: t.Identifier): boolean {
  let removed = false

  // The checks use sequential if/else if statements since it
  // directly mutates the AST and as such doing normal checks
  // (using only if statements) could lead to a situation where
  // `path.node` is null since it has been already removed from
  // the program tree but typescript doesn't know that.
  babel.traverse(ast, {
    ExportNamedDeclaration(path) {
      if (path.node.declaration) {
        if (t.isVariableDeclaration(path.node.declaration)) {
          // declared as `const loaderFn = () => {}`
          path.node.declaration.declarations.forEach((decl) => {
            if (t.isVariableDeclarator(decl)) {
              if (t.isIdentifier(decl.id)) {
                if (decl.id.name === node.name) {
                  path.remove()
                  removed = true
                }
              } else if (
                t.isObjectPattern(decl.id) ||
                t.isArrayPattern(decl.id)
              ) {
                // Handle destructured exports like `export const { a, b } = fn()`
                const names = collectIdentifiersFromPattern(decl.id)
                if (names.includes(node.name)) {
                  path.remove()
                  removed = true
                }
              }
            }
          })
        } else if (t.isFunctionDeclaration(path.node.declaration)) {
          // declared as `export const loaderFn = () => {}`
          if (t.isIdentifier(path.node.declaration.id)) {
            if (path.node.declaration.id.name === node.name) {
              path.remove()
              removed = true
            }
          }
        }
      }
    },
    ExportDefaultDeclaration(path) {
      // declared as `export default loaderFn`
      if (t.isIdentifier(path.node.declaration)) {
        if (path.node.declaration.name === node.name) {
          path.remove()
          removed = true
        }
      } else if (t.isFunctionDeclaration(path.node.declaration)) {
        // declared as `export default function loaderFn() {}`
        if (t.isIdentifier(path.node.declaration.id)) {
          if (path.node.declaration.id.name === node.name) {
            path.remove()
            removed = true
          }
        }
      }
    },
  })

  return removed
}
