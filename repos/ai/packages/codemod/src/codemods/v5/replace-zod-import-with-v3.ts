import { createTransformer } from '../lib/create-transformer';

export default createTransformer((fileInfo, api, options, context) => {
  const { j, root } = context;

  root
    .find(j.ImportDeclaration, {
      source: {
        type: 'StringLiteral',
        value: 'zod',
      },
    })
    .forEach(path => {
      const importDeclaration = path.node;

      const newSpecifiers =
        importDeclaration.specifiers?.map(spec => {
          if (spec.type === 'ImportDefaultSpecifier') {
            return j.importSpecifier(j.identifier(spec.local?.name || 'z'));
          }
          return spec;
        }) || [];

      const newImport = j.importDeclaration(
        newSpecifiers,
        j.stringLiteral('zod/v3'),
      );

      newImport.comments = importDeclaration.comments;

      j(path).replaceWith(newImport);
      context.hasChanges = true;
    });
});
