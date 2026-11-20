export {
  parseAst,
  generateFromAst,
  deadCodeElimination,
  findReferencedIdentifiers,
  stripTypeExports,
} from './ast'
export type { ParseAstOptions, ParseAstResult, GeneratorResult } from './ast'
export { logDiff } from './logger'

export { copyFilesPlugin } from './copy-files-plugin'

export { createIdentifier, decodeIdentifier } from './path-ids'

export {
  buildDeclarationMap,
  buildDependencyGraph,
  collectIdentifiersFromNode,
  collectIdentifiersFromPattern,
  collectLocalBindingsFromStatement,
  collectModuleLevelRefsFromNode,
  expandDestructuredDeclarations,
  expandSharedDestructuredDeclarators,
  expandTransitively,
  extractModuleInfoFromAst,
  getVariableDeclaratorForExpressionPath,
  removeBindingsTransitivelyDependingOn,
  removeModuleLevelBindings,
  retainModuleLevelDeclarations,
  stripUnreferencedTopLevelExpressionStatements,
  unwrapExpression,
  unwrapExportedDeclarations,
} from './compiler-helpers'
export type { ExtractedModuleInfo, ModuleInfoBinding } from './compiler-helpers'
