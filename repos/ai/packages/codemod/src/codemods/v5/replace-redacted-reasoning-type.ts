import { createTransformer } from '../lib/create-transformer';

export default createTransformer((fileInfo, api, options, context) => {
  const { j, root } = context;

  const foundUsages: Array<{
    line: number;
    context: string;
  }> = [];

  // Find string literals that match 'redacted-reasoning'
  root.find(j.Literal).forEach(path => {
    if (path.node.value === 'redacted-reasoning') {
      const lineNumber = path.node.loc?.start?.line || 0;

      // Try to determine the context (e.g., if condition, switch case, etc.)
      let context = 'unknown context';

      // Check if this is in a comparison (e.g., part.type === 'redacted-reasoning')
      const parent = path.parent.node;
      if (
        parent &&
        parent.type === 'BinaryExpression' &&
        parent.operator === '==='
      ) {
        const left = parent.left;
        if (
          left.type === 'MemberExpression' &&
          left.property.type === 'Identifier' &&
          left.property.name === 'type'
        ) {
          context = 'type comparison';
        }
      }

      // Check if this is in a switch case
      let currentPath = path.parent;
      while (currentPath && currentPath.node) {
        if (currentPath.node.type === 'SwitchCase') {
          context = 'switch case';
          break;
        }
        currentPath = currentPath.parent;
      }

      foundUsages.push({
        line: lineNumber,
        context: context,
      });
    }
  });

  // Also find template literals that might contain 'redacted-reasoning'
  root.find(j.TemplateLiteral).forEach(path => {
    path.node.quasis.forEach(quasi => {
      if (quasi.value.raw.includes('redacted-reasoning')) {
        const lineNumber = path.node.loc?.start?.line || 0;
        foundUsages.push({
          line: lineNumber,
          context: 'template literal',
        });
      }
    });
  });

  // Generate helpful messages for found usages
  if (foundUsages.length > 0) {
    context.messages.push(
      `Found ${foundUsages.length} usage(s) of 'redacted-reasoning' part type that need migration:`,
    );

    foundUsages.forEach(usage => {
      context.messages.push(`  Line ${usage.line}: ${usage.context}`);
    });

    context.messages.push('');
    context.messages.push('Migration required:');
    context.messages.push(
      '  The redacted-reasoning part type has been removed.',
    );
    context.messages.push('  Use provider-specific metadata instead:');
    context.messages.push('');
    context.messages.push('  Before:');
    context.messages.push('    if (part.type === "redacted-reasoning") {');
    context.messages.push('      console.log("<redacted>");');
    context.messages.push('    }');
    context.messages.push('');
    context.messages.push('  After:');
    context.messages.push(
      '    if (part.providerMetadata?.anthropic?.redactedData != null) {',
    );
    context.messages.push('      console.log("<redacted>");');
    context.messages.push('    }');
    context.messages.push('');
    context.messages.push(
      '  Note: The exact metadata path depends on your provider.',
    );
    context.messages.push(
      '  Check your provider documentation for the correct path.',
    );
  }
});
