import { createTransformer } from '../lib/create-transformer';

export default createTransformer((fileInfo, api, options, context) => {
  const { j, root } = context;

  // Only apply to files that import from @ai-sdk/google-vertex
  const hasVertexImport =
    root
      .find(j.ImportDeclaration)
      .filter(path => {
        return (
          path.node.source.type === 'StringLiteral' &&
          (path.node.source.value === '@ai-sdk/google-vertex' ||
            path.node.source.value === '@ai-sdk/google-vertex/edge')
        );
      })
      .size() > 0;

  if (!hasVertexImport) {
    return;
  }

  // Helper to check if a node represents providerMetadata access
  const isProviderMetadataAccess = (object: any): boolean => {
    if (object.type === 'Identifier') {
      return object.name === 'providerMetadata';
    }
    // Handle chained access like result.providerMetadata or event?.providerMetadata
    if (
      object.type === 'MemberExpression' ||
      object.type === 'OptionalMemberExpression'
    ) {
      const prop = object.property;
      return prop.type === 'Identifier' && prop.name === 'providerMetadata';
    }
    return false;
  };

  // Helper to check if a node is inside a providerOptions object
  const isInsideProviderOptions = (path: any): boolean => {
    let current = path.parent;
    while (current) {
      if (current.node.type === 'ObjectExpression') {
        const grandparent = current.parent;
        if (
          grandparent &&
          (grandparent.node.type === 'Property' ||
            grandparent.node.type === 'ObjectProperty')
        ) {
          const key = grandparent.node.key;
          if (key.type === 'Identifier' && key.name === 'providerOptions') {
            return true;
          }
        }
      }
      current = current.parent;
    }
    return false;
  };

  // Transform providerMetadata?.google and providerMetadata.google
  // Using MemberExpression (covers both optional and non-optional in jscodeshift)
  root.find(j.MemberExpression).forEach(path => {
    const property = path.node.property;
    const object = path.node.object;

    // Property must be 'google'
    if (property.type !== 'Identifier' || property.name !== 'google') {
      return;
    }

    // Check if accessing providerMetadata
    if (isProviderMetadataAccess(object)) {
      property.name = 'vertex';
      context.hasChanges = true;
    }
  });

  // Transform destructuring: const { google } = providerMetadata
  // Also handles: const { google: metadata } = providerMetadata
  root.find(j.VariableDeclarator).forEach(path => {
    const id = path.node.id;
    const init = path.node.init;

    if (id.type !== 'ObjectPattern') {
      return;
    }

    // Check if init is providerMetadata or something?.providerMetadata
    let isFromProviderMetadata = false;
    if (init) {
      if (init.type === 'Identifier' && init.name === 'providerMetadata') {
        isFromProviderMetadata = true;
      } else if (
        (init.type === 'MemberExpression' ||
          init.type === 'OptionalMemberExpression') &&
        init.property.type === 'Identifier' &&
        init.property.name === 'providerMetadata'
      ) {
        isFromProviderMetadata = true;
      } else if (
        init.type === 'LogicalExpression' &&
        init.operator === '??' &&
        init.left.type === 'MemberExpression' &&
        init.left.property.type === 'Identifier' &&
        init.left.property.name === 'providerMetadata'
      ) {
        // Handle: const { google } = result.providerMetadata ?? {}
        isFromProviderMetadata = true;
      }
    }

    if (!isFromProviderMetadata) {
      return;
    }

    // Find and rename 'google' property in destructuring
    id.properties.forEach(prop => {
      if (prop.type === 'ObjectProperty' || prop.type === 'Property') {
        const key = prop.key;
        if (key.type === 'Identifier' && key.name === 'google') {
          key.name = 'vertex';
          // If shorthand, also rename the value
          if (
            prop.shorthand &&
            prop.value.type === 'Identifier' &&
            prop.value.name === 'google'
          ) {
            prop.value.name = 'vertex';
          }
          context.hasChanges = true;
        }
      }
    });
  });

  // Transform providerOptions: { google: {...} } → providerOptions: { vertex: {...} }
  root.find(j.Property).forEach(path => {
    const key = path.node.key;

    // Key must be 'google'
    if (key.type !== 'Identifier' || key.name !== 'google') {
      return;
    }

    // Check if this property is inside a providerOptions object
    if (isInsideProviderOptions(path)) {
      key.name = 'vertex';
      context.hasChanges = true;
    }
  });

  // Also handle ObjectProperty (for some AST variations)
  root.find(j.ObjectProperty).forEach(path => {
    const key = path.node.key;

    if (key.type !== 'Identifier' || key.name !== 'google') {
      return;
    }

    if (isInsideProviderOptions(path)) {
      key.name = 'vertex';
      context.hasChanges = true;
    }
  });
});
