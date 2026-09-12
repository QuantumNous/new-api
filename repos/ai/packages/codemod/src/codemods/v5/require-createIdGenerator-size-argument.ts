import { createTransformer } from '../lib/create-transformer';

export default createTransformer((fileInfo, api, options, context) => {
  const { j, root } = context;

  // Map to track generator variable names and their createIdGenerator call sites
  const generatorVariables = new Map<string, any>();

  // Map to track generator variable names and the sizes used in calls
  const generatorSizes = new Map<string, number>();

  // First pass: Find all createIdGenerator variable declarations
  root
    .find(j.VariableDeclarator)
    .filter(path => {
      return Boolean(
        path.node.init &&
        j.CallExpression.check(path.node.init) &&
        j.Identifier.check(path.node.init.callee) &&
        path.node.init.callee.name === 'createIdGenerator',
      );
    })
    .forEach(path => {
      if (j.Identifier.check(path.node.id)) {
        generatorVariables.set(path.node.id.name, path);
      }
    });

  // Also find createIdGenerator assignments (not just declarations)
  root
    .find(j.AssignmentExpression)
    .filter(path => {
      return (
        j.CallExpression.check(path.node.right) &&
        j.Identifier.check(path.node.right.callee) &&
        path.node.right.callee.name === 'createIdGenerator' &&
        j.Identifier.check(path.node.left)
      );
    })
    .forEach(path => {
      if (j.Identifier.check(path.node.left)) {
        generatorVariables.set(path.node.left.name, path);
      }
    });

  // Second pass: Find calls to generator variables to extract size arguments
  root
    .find(j.CallExpression)
    .filter(path => {
      return (
        j.Identifier.check(path.node.callee) &&
        generatorVariables.has(path.node.callee.name)
      );
    })
    .forEach(path => {
      const generatorName = (path.node.callee as any).name;
      const args = path.node.arguments;

      if (
        args.length > 0 &&
        j.Literal.check(args[0]) &&
        typeof args[0].value === 'number'
      ) {
        const size = args[0].value as number;
        // Store the size for this generator (assuming all calls use same size)
        if (!generatorSizes.has(generatorName)) {
          generatorSizes.set(generatorName, size);
        }
      }
    });

  // Third pass: Update createIdGenerator calls to include size in options
  generatorVariables.forEach((path, generatorName) => {
    const size = generatorSizes.get(generatorName);
    if (size !== undefined) {
      // Handle both variable declarations and assignments
      const callExpression = j.VariableDeclarator.check(path.node)
        ? (path.node.init as any)
        : (path.node.right as any); // AssignmentExpression
      const args = callExpression.arguments;

      if (args.length === 0) {
        // createIdGenerator() -> createIdGenerator({ size: X })
        callExpression.arguments = [
          j.objectExpression([
            j.objectProperty(j.identifier('size'), j.literal(size)),
          ]),
        ];
      } else if (args.length === 1 && j.ObjectExpression.check(args[0])) {
        // createIdGenerator({ prefix: 'msg' }) -> createIdGenerator({ prefix: 'msg', size: X })
        const existingProps = args[0].properties;
        const sizeProperty = j.objectProperty(
          j.identifier('size'),
          j.literal(size),
        );
        args[0].properties = [...existingProps, sizeProperty];
      }

      context.hasChanges = true;
    }
  });

  // Fourth pass: Remove size arguments from generator function calls
  root
    .find(j.CallExpression)
    .filter(path => {
      return (
        j.Identifier.check(path.node.callee) &&
        generatorVariables.has(path.node.callee.name)
      );
    })
    .forEach(path => {
      if (path.node.arguments.length > 0) {
        path.node.arguments = [];
        context.hasChanges = true;
      }
    });
});
