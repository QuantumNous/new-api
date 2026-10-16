import { createTransformer } from '../lib/create-transformer';

/**
 * Removes sendExtraMessageFields property from useChat calls since it's now the default behavior
 *
 * Before:
 * const { messages } = useChat({
 *   sendExtraMessageFields: true
 * });
 *
 * After:
 * const { messages } = useChat({
 * });
 */
export default createTransformer((fileInfo, api, options, context) => {
  const { j, root } = context;

  // Find useChat call expressions
  root
    .find(j.CallExpression, {
      callee: {
        type: 'Identifier',
        name: 'useChat',
      },
    })
    .forEach(path => {
      const args = path.node.arguments;
      if (args.length !== 1 || args[0].type !== 'ObjectExpression') {
        return;
      }

      const configObject = args[0];
      let foundSendExtraMessageFields = false;

      // Find and remove sendExtraMessageFields property
      configObject.properties = configObject.properties.filter((prop: any) => {
        if (
          (prop.type === 'Property' || prop.type === 'ObjectProperty') &&
          ((prop.key.type === 'Identifier' &&
            prop.key.name === 'sendExtraMessageFields') ||
            (prop.key.type === 'Literal' &&
              prop.key.value === 'sendExtraMessageFields') ||
            (prop.key.type === 'StringLiteral' &&
              prop.key.value === 'sendExtraMessageFields'))
        ) {
          foundSendExtraMessageFields = true;
          context.hasChanges = true;
          return false; // Remove this property
        }
        return true; // Keep other properties
      });

      // If the object is now empty and we removed the property, we can simplify the call
      if (foundSendExtraMessageFields && configObject.properties.length === 0) {
        // Keep the empty object for now - user can clean up manually if desired
        // This preserves the original structure and is safer
      }
    });
});
