import { createTransformer } from '../lib/create-transformer';

export default createTransformer((fileInfo, api, options, context) => {
  const { j, root } = context;

  // Methods that return objects with rawResponse
  const aiMethods = [
    'embed',
    'embedMany',
    'generateText',
    'generateObject',
    'streamObject',
    'streamText',
  ];

  // Track variable names that store results from AI methods
  const aiResultVariables = new Set<string>();
  // Track destructured rawResponse variable names and their new names
  const destructuredMapping = new Map<string, string>();

  // Find variable declarations from AI method calls
  root.find(j.VariableDeclarator).forEach(path => {
    const { id, init } = path.node;

    // Handle await AI method calls
    if (
      init &&
      init.type === 'AwaitExpression' &&
      init.argument &&
      init.argument.type === 'CallExpression' &&
      init.argument.callee.type === 'Identifier' &&
      aiMethods.includes(init.argument.callee.name)
    ) {
      if (id.type === 'Identifier') {
        aiResultVariables.add(id.name);
      } else if (id.type === 'ObjectPattern') {
        // Check if both response and rawResponse are present
        const hasResponse = id.properties.some(
          prop =>
            (prop.type === 'Property' || prop.type === 'ObjectProperty') &&
            prop.key.type === 'Identifier' &&
            prop.key.name === 'response',
        );

        let rawResponseVarName: string | null = null;

        // First pass: find rawResponse and track its variable name
        id.properties.forEach(prop => {
          if (
            (prop.type === 'Property' || prop.type === 'ObjectProperty') &&
            prop.key.type === 'Identifier' &&
            prop.key.name === 'rawResponse' &&
            prop.value.type === 'Identifier'
          ) {
            rawResponseVarName = prop.value.name;
          }
        });

        // Second pass: handle the transformation
        if (hasResponse && rawResponseVarName) {
          // If response already exists, remove rawResponse and map its variable to 'response'
          id.properties = id.properties.filter(
            prop =>
              !(
                (prop.type === 'Property' || prop.type === 'ObjectProperty') &&
                prop.key.type === 'Identifier' &&
                prop.key.name === 'rawResponse'
              ),
          );

          // Find the response variable name to map rawResponse variable to it
          const responseProp = id.properties.find(
            prop =>
              (prop.type === 'Property' || prop.type === 'ObjectProperty') &&
              prop.key.type === 'Identifier' &&
              prop.key.name === 'response',
          ) as any;

          if (
            responseProp &&
            responseProp.value &&
            responseProp.value.type === 'Identifier'
          ) {
            destructuredMapping.set(
              rawResponseVarName,
              responseProp.value.name,
            );
          }
          context.hasChanges = true;
        } else {
          // If response doesn't exist, rename rawResponse to response
          id.properties.forEach(prop => {
            if (
              (prop.type === 'Property' || prop.type === 'ObjectProperty') &&
              prop.key.type === 'Identifier' &&
              prop.key.name === 'rawResponse' &&
              prop.value.type === 'Identifier'
            ) {
              context.hasChanges = true;
              prop.key.name = 'response';
              // Track the destructured variable name mapping
              destructuredMapping.set(prop.value.name, 'response');
            }
          });
        }
      }
    }

    // Handle non-await streaming method calls
    if (
      init &&
      init.type === 'CallExpression' &&
      init.callee.type === 'Identifier' &&
      ['streamObject', 'streamText'].includes(init.callee.name)
    ) {
      if (id.type === 'Identifier') {
        aiResultVariables.add(id.name);
      } else if (id.type === 'ObjectPattern') {
        // Similar logic for streaming methods
        const hasResponse = id.properties.some(
          prop =>
            (prop.type === 'Property' || prop.type === 'ObjectProperty') &&
            prop.key.type === 'Identifier' &&
            prop.key.name === 'response',
        );

        let rawResponseVarName: string | null = null;

        id.properties.forEach(prop => {
          if (
            (prop.type === 'Property' || prop.type === 'ObjectProperty') &&
            prop.key.type === 'Identifier' &&
            prop.key.name === 'rawResponse' &&
            prop.value.type === 'Identifier'
          ) {
            rawResponseVarName = prop.value.name;
          }
        });

        if (hasResponse && rawResponseVarName) {
          id.properties = id.properties.filter(
            prop =>
              !(
                (prop.type === 'Property' || prop.type === 'ObjectProperty') &&
                prop.key.type === 'Identifier' &&
                prop.key.name === 'rawResponse'
              ),
          );

          const responseProp = id.properties.find(
            prop =>
              (prop.type === 'Property' || prop.type === 'ObjectProperty') &&
              prop.key.type === 'Identifier' &&
              prop.key.name === 'response',
          ) as any;

          if (
            responseProp &&
            responseProp.value &&
            responseProp.value.type === 'Identifier'
          ) {
            destructuredMapping.set(
              rawResponseVarName,
              responseProp.value.name,
            );
          }
          context.hasChanges = true;
        } else {
          id.properties.forEach(prop => {
            if (
              (prop.type === 'Property' || prop.type === 'ObjectProperty') &&
              prop.key.type === 'Identifier' &&
              prop.key.name === 'rawResponse' &&
              prop.value.type === 'Identifier'
            ) {
              context.hasChanges = true;
              prop.key.name = 'response';
              destructuredMapping.set(prop.value.name, 'response');
            }
          });
        }
      }
    }
  });

  // Find assignment expressions from AI method calls
  root.find(j.AssignmentExpression).forEach(path => {
    const { left, right } = path.node;

    // Handle await AI method calls
    if (
      right.type === 'AwaitExpression' &&
      right.argument &&
      right.argument.type === 'CallExpression' &&
      right.argument.callee.type === 'Identifier' &&
      aiMethods.includes(right.argument.callee.name)
    ) {
      if (left.type === 'Identifier') {
        aiResultVariables.add(left.name);
      }
    }

    // Handle non-await streaming method calls
    if (
      right.type === 'CallExpression' &&
      right.callee.type === 'Identifier' &&
      ['streamObject', 'streamText'].includes(right.callee.name)
    ) {
      if (left.type === 'Identifier') {
        aiResultVariables.add(left.name);
      }
    }
  });

  // Transform member expressions accessing .rawResponse on AI result variables
  root.find(j.MemberExpression).forEach(path => {
    const { object, property } = path.node;

    if (property.type === 'Identifier' && property.name === 'rawResponse') {
      // Direct access: variable.rawResponse
      if (object.type === 'Identifier' && aiResultVariables.has(object.name)) {
        context.hasChanges = true;
        property.name = 'response';
      }

      // Nested access: something.rawResponse where something might be an AI result
      let currentObj = object;
      while (currentObj.type === 'MemberExpression') {
        currentObj = currentObj.object;
      }

      if (
        currentObj.type === 'Identifier' &&
        aiResultVariables.has(currentObj.name)
      ) {
        context.hasChanges = true;
        property.name = 'response';
      }
    }
  });

  // Transform identifiers that were destructured as rawResponse
  root.find(j.Identifier).forEach(path => {
    const varName = path.node.name;
    if (varName && destructuredMapping.has(varName)) {
      // Check if this identifier should be transformed
      const parent = path.parent;

      // Don't transform if it's a property key in an object
      if (
        (parent.value.type === 'Property' ||
          parent.value.type === 'ObjectProperty') &&
        parent.value.key === path.node
      ) {
        return;
      }

      // Don't transform if it's in a variable declarator pattern (already handled)
      if (
        parent.value.type === 'VariableDeclarator' &&
        parent.value.id === path.node
      ) {
        return;
      }

      // Transform the identifier
      context.hasChanges = true;
      path.node.name = destructuredMapping.get(varName)!;
    }
  });
});
