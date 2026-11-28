import { createTransformer } from '../lib/create-transformer';

export default createTransformer((fileInfo, api, options, context) => {
  const { j, root } = context;

  // Helper function to convert snake_case to camelCase
  function snakeToCamel(str: string): string {
    return str.replace(/_([a-z])/g, (match, letter) => letter.toUpperCase());
  }

  // Helper function to recursively transform snake_case properties in an object
  function transformBedrockProperties(objExpression: any) {
    if (objExpression.type !== 'ObjectExpression') return;

    objExpression.properties.forEach((prop: any) => {
      if (
        (prop.type === 'ObjectProperty' || prop.type === 'Property') &&
        prop.key.type === 'Identifier'
      ) {
        const originalName = prop.key.name;
        const camelCaseName = snakeToCamel(originalName);

        // Only transform if the name actually changes (contains snake_case)
        if (originalName !== camelCaseName && originalName.includes('_')) {
          context.hasChanges = true;
          prop.key = j.identifier(camelCaseName);
        }

        // Recursively transform nested objects
        if (prop.value.type === 'ObjectExpression') {
          transformBedrockProperties(prop.value);
        }
      }
    });
  }

  // Find all ObjectExpression nodes that could contain providerOptions
  root.find(j.ObjectExpression).forEach(objectPath => {
    // Look for providerOptions property within this object
    objectPath.node.properties.forEach((prop: any) => {
      if (
        (prop.type === 'ObjectProperty' || prop.type === 'Property') &&
        prop.key.type === 'Identifier' &&
        prop.key.name === 'providerOptions' &&
        prop.value.type === 'ObjectExpression'
      ) {
        // Found providerOptions, now look for bedrock property
        prop.value.properties.forEach((providerProp: any) => {
          if (
            (providerProp.type === 'ObjectProperty' ||
              providerProp.type === 'Property') &&
            providerProp.key.type === 'Identifier' &&
            providerProp.key.name === 'bedrock' &&
            providerProp.value.type === 'ObjectExpression'
          ) {
            // Found bedrock, transform its properties
            transformBedrockProperties(providerProp.value);
          }
        });
      }
    });
  });
});
