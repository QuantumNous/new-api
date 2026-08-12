import { createTransformer } from '../lib/create-transformer';

const EXPERIMENTAL_MAPPINGS = {
  experimental_generateText: 'generateText',
  experimental_streamText: 'streamText',
  experimental_generateObject: 'generateObject',
  experimental_streamObject: 'streamObject',
} as const;

export default createTransformer((fileInfo, api, options, context) => {
  const { j, root } = context;

  // Replace imports of experimental functions
  root.find(j.ImportDeclaration).forEach(path => {
    if (path.node.source.value === 'ai') {
      path.node.specifiers?.forEach(specifier => {
        if (
          specifier.type === 'ImportSpecifier' &&
          specifier.imported.type === 'Identifier' &&
          specifier.imported.name in EXPERIMENTAL_MAPPINGS
        ) {
          context.hasChanges = true;
          const newName =
            EXPERIMENTAL_MAPPINGS[
              specifier.imported.name as keyof typeof EXPERIMENTAL_MAPPINGS
            ];
          specifier.imported.name = newName;
          if (specifier.local) {
            specifier.local.name = newName;
          }
        }
      });
    }
  });

  // Replace calls to experimental functions
  root.find(j.CallExpression).forEach(path => {
    if (
      path.node.callee.type === 'Identifier' &&
      path.node.callee.name in EXPERIMENTAL_MAPPINGS
    ) {
      context.hasChanges = true;
      path.node.callee.name =
        EXPERIMENTAL_MAPPINGS[
          path.node.callee.name as keyof typeof EXPERIMENTAL_MAPPINGS
        ];
    }
  });
});
