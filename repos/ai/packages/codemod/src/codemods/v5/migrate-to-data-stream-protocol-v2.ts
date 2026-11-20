import { createTransformer } from '../lib/create-transformer';

/**
 * Migrates from Data Stream Protocol v1 to v2:
 * - writer.writeData(value) → writer.write({ type: 'data', value: [value] })
 * - writer.writeMessageAnnotation(obj) → writer.write({ type: 'message-annotations', value: [obj] })
 * - writer.writeSource(obj) → writer.write({ type: 'source', value: obj })
 * - formatDataStreamPart('tool_result', obj) → { type: 'tool-result', value: obj }
 * - Removes unused formatDataStreamPart imports
 */
export default createTransformer((fileInfo, api, options, context) => {
  const { j, root } = context;

  // Transform writer.writeData() calls
  root
    .find(j.CallExpression, {
      callee: {
        type: 'MemberExpression',
        property: { name: 'writeData' },
      },
    })
    .forEach((path: any) => {
      const args = path.node.arguments;
      if (args.length === 1) {
        // Transform writeData(value) to write({ type: 'data', value: [value] })
        path.node.callee.property.name = 'write';
        path.node.arguments = [
          j.objectExpression([
            j.property('init', j.literal('type'), j.literal('data')),
            j.property(
              'init',
              j.literal('value'),
              j.arrayExpression([args[0]]),
            ),
          ]),
        ];
        context.hasChanges = true;
      }
    });

  // Transform writer.writeMessageAnnotation() calls
  root
    .find(j.CallExpression, {
      callee: {
        type: 'MemberExpression',
        property: { name: 'writeMessageAnnotation' },
      },
    })
    .forEach((path: any) => {
      const args = path.node.arguments;
      if (args.length === 1) {
        // Transform writeMessageAnnotation(obj) to write({ type: 'message-annotations', value: [obj] })
        path.node.callee.property.name = 'write';
        path.node.arguments = [
          j.objectExpression([
            j.property(
              'init',
              j.literal('type'),
              j.literal('message-annotations'),
            ),
            j.property(
              'init',
              j.literal('value'),
              j.arrayExpression([args[0]]),
            ),
          ]),
        ];
        context.hasChanges = true;
      }
    });

  // Transform writer.writeSource() calls
  root
    .find(j.CallExpression, {
      callee: {
        type: 'MemberExpression',
        property: { name: 'writeSource' },
      },
    })
    .forEach((path: any) => {
      const args = path.node.arguments;
      if (args.length === 1 && args[0].type === 'ObjectExpression') {
        // Transform writeSource(obj) to write({ type: 'source', value: obj })
        const sourceObj = args[0];

        path.node.callee.property.name = 'write';
        path.node.arguments = [
          j.objectExpression([
            j.property('init', j.literal('type'), j.literal('source')),
            j.property('init', j.literal('value'), sourceObj),
          ]),
        ];
        context.hasChanges = true;
      }
    });

  // Transform formatDataStreamPart() calls for tool results
  root
    .find(j.CallExpression, {
      callee: { name: 'formatDataStreamPart' },
    })
    .forEach((path: any) => {
      const args = path.node.arguments;
      if (args.length === 2) {
        const typeArg = args[0];
        const valueArg = args[1];

        // Replace the formatDataStreamPart call with the new format
        if (
          (typeArg.type === 'Literal' || typeArg.type === 'StringLiteral') &&
          typeArg.value === 'tool_result'
        ) {
          // Transform formatDataStreamPart('tool_result', obj) to { type: 'tool-result', value: obj }
          j(path).replaceWith(
            j.objectExpression([
              j.property('init', j.literal('type'), j.literal('tool-result')),
              j.property('init', j.literal('value'), valueArg),
            ]),
          );
          context.hasChanges = true;
        }
      }
    });

  // Remove formatDataStreamPart import if it's no longer used
  // Check after all transformations are done
  const formatDataStreamPartUsages = root.find(j.CallExpression, {
    callee: { name: 'formatDataStreamPart' },
  });

  if (formatDataStreamPartUsages.length === 0) {
    root.find(j.ImportDeclaration).forEach((path: any) => {
      if (
        path.node.source.value === 'ai' &&
        path.node.specifiers?.some(
          (spec: any) =>
            spec.type === 'ImportSpecifier' &&
            spec.imported.name === 'formatDataStreamPart',
        )
      ) {
        // Remove the import
        path.node.specifiers = path.node.specifiers?.filter(
          (spec: any) =>
            !(
              spec.type === 'ImportSpecifier' &&
              spec.imported.name === 'formatDataStreamPart'
            ),
        );

        // If no specifiers left, remove the entire import
        if (path.node.specifiers?.length === 0) {
          path.prune();
        }

        context.hasChanges = true;
      }
    });
  }
});
