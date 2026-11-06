import { createTransformer } from './create-transformer';

interface FacadeConfig {
  packageName: string; // e.g. 'openai'
  className: string; // e.g. 'OpenAI'
  createFnName: string; // e.g. 'createOpenAI'
}

export function removeFacade(config: FacadeConfig) {
  return createTransformer((fileInfo, api, options, context) => {
    const { j, root } = context;
    const importPath = `@ai-sdk/${config.packageName}`;

    // Track which imports came from our target package
    const targetImports = new Set<string>();

    // First pass - collect imports from our target package
    root
      .find(j.ImportDeclaration)
      .filter(path => path.node.source.value === importPath)
      .forEach(path => {
        path.node.specifiers?.forEach(spec => {
          if (
            spec.type === 'ImportSpecifier' &&
            spec.imported.name === config.className &&
            spec.local
          ) {
            context.hasChanges = true;
            targetImports.add(spec.local.name);
          }
        });
      });

    // Second pass - replace imports we found
    root
      .find(j.ImportDeclaration)
      .filter(path => path.node.source.value === importPath)
      .forEach(path => {
        const hasClassSpecifier = path.node.specifiers?.some(
          spec =>
            spec.type === 'ImportSpecifier' &&
            spec.imported.name === config.className,
        );

        if (hasClassSpecifier) {
          context.hasChanges = true;
          path.node.specifiers = [
            j.importSpecifier(j.identifier(config.createFnName)),
          ];
        }
      });

    // Only replace new expressions for classes from our package
    root
      .find(j.NewExpression)
      .filter(
        path =>
          path.node.callee.type === 'Identifier' &&
          targetImports.has(path.node.callee.name),
      )
      .forEach(path => {
        context.hasChanges = true;
        j(path).replaceWith(
          j.callExpression(
            j.identifier(config.createFnName),
            path.node.arguments,
          ),
        );
      });
  });
}
