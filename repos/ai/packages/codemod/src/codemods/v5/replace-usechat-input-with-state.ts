import { createTransformer } from '../lib/create-transformer';

export default createTransformer((fileInfo, api, options, context) => {
  const { j, root } = context;

  // Track all useChat import names (including aliases)
  const useChatNames = new Set<string>();

  // Replace old import path with new one and collect useChat import names
  root
    .find(j.ImportDeclaration, {
      source: { value: 'ai/react' },
    })
    .forEach(path => {
      const importDeclaration = path.node;
      importDeclaration.source.value = '@ai-sdk/react';

      // Collect useChat import names
      importDeclaration.specifiers?.forEach(spec => {
        if (
          spec.type === 'ImportSpecifier' &&
          spec.imported.type === 'Identifier' &&
          spec.imported.name === 'useChat'
        ) {
          useChatNames.add(spec.local?.name || 'useChat');
        }
      });

      context.hasChanges = true;
    });

  // Also collect useChat names from existing @ai-sdk/react imports
  root
    .find(j.ImportDeclaration, {
      source: { value: '@ai-sdk/react' },
    })
    .forEach(path => {
      const importDeclaration = path.node;

      // Collect useChat import names
      importDeclaration.specifiers?.forEach(spec => {
        if (
          spec.type === 'ImportSpecifier' &&
          spec.imported.type === 'Identifier' &&
          spec.imported.name === 'useChat'
        ) {
          useChatNames.add(spec.local?.name || 'useChat');
        }
      });
    });

  let needsUseStateImport = false;
  const inputStates: Array<{
    inputName: string;
    setterName: string;
    parentPath: any;
  }> = [];

  root.find(j.VariableDeclarator).forEach(path => {
    const init = path.node.init;
    const id = path.node.id;

    if (
      !init ||
      init.type !== 'CallExpression' ||
      init.callee.type !== 'Identifier' ||
      !useChatNames.has(init.callee.name) ||
      id.type !== 'ObjectPattern'
    ) {
      return;
    }

    const objectPattern = id;
    let inputName = '';
    let handleInputChangeName = '';
    let foundInput = false;
    let foundHandleInputChange = false;
    const filteredProperties: any[] = [];

    objectPattern.properties.forEach((prop: any) => {
      if (prop.type === 'Property' || prop.type === 'ObjectProperty') {
        if (prop.key.type === 'Identifier') {
          if (prop.key.name === 'input') {
            foundInput = true;
            if (prop.value && prop.value.type === 'Identifier') {
              inputName = prop.value.name;
            } else if (prop.shorthand) {
              inputName = 'input';
            }
          } else if (prop.key.name === 'handleInputChange') {
            foundHandleInputChange = true;
            if (prop.value && prop.value.type === 'Identifier') {
              handleInputChangeName = prop.value.name;
            } else if (prop.shorthand) {
              handleInputChangeName = 'handleInputChange';
            }
          } else {
            filteredProperties.push(prop);
          }
        } else {
          filteredProperties.push(prop);
        }
      } else {
        filteredProperties.push(prop);
      }
    });

    if (foundInput || foundHandleInputChange) {
      context.hasChanges = true;

      objectPattern.properties = filteredProperties;

      if (foundInput && inputName) {
        needsUseStateImport = true;
        const setterName = `set${inputName.charAt(0).toUpperCase()}${inputName.slice(1)}`;

        inputStates.push({
          inputName,
          setterName,
          parentPath: path.parent,
        });

        if (foundHandleInputChange && handleInputChangeName) {
          const functionScope =
            j(path).closest(j.FunctionDeclaration).size() > 0
              ? j(path).closest(j.FunctionDeclaration)
              : j(path).closest(j.FunctionExpression).size() > 0
                ? j(path).closest(j.FunctionExpression)
                : j(path).closest(j.ArrowFunctionExpression);

          functionScope
            .find(j.Identifier, { name: handleInputChangeName })
            .filter(idPath => {
              const parent = idPath.parent.node;
              return !(
                ((parent.type === 'Property' ||
                  parent.type === 'ObjectProperty') &&
                  parent.key === idPath.node) ||
                (parent.type === 'MemberExpression' &&
                  parent.property === idPath.node &&
                  !parent.computed)
              );
            })
            .replaceWith(() => {
              return j.arrowFunctionExpression(
                [j.identifier('e')],
                j.callExpression(j.identifier(setterName), [
                  j.memberExpression(
                    j.memberExpression(
                      j.identifier('e'),
                      j.identifier('target'),
                    ),
                    j.identifier('value'),
                  ),
                ]),
              );
            });
        }
      } else if (foundHandleInputChange && handleInputChangeName) {
        needsUseStateImport = true;
        const inputName = 'input';
        const setterName = 'setInput';

        inputStates.push({
          inputName,
          setterName,
          parentPath: path.parent,
        });

        const functionScope =
          j(path).closest(j.FunctionDeclaration).size() > 0
            ? j(path).closest(j.FunctionDeclaration)
            : j(path).closest(j.FunctionExpression).size() > 0
              ? j(path).closest(j.FunctionExpression)
              : j(path).closest(j.ArrowFunctionExpression);

        functionScope
          .find(j.Identifier, { name: handleInputChangeName })
          .filter(idPath => {
            const parent = idPath.parent.node;
            return !(
              ((parent.type === 'Property' ||
                parent.type === 'ObjectProperty') &&
                parent.key === idPath.node) ||
              (parent.type === 'MemberExpression' &&
                parent.property === idPath.node &&
                !parent.computed)
            );
          })
          .replaceWith(() => {
            return j.arrowFunctionExpression(
              [j.identifier('e')],
              j.callExpression(j.identifier(setterName), [
                j.memberExpression(
                  j.memberExpression(j.identifier('e'), j.identifier('target')),
                  j.identifier('value'),
                ),
              ]),
            );
          });
      }
    }
  });

  inputStates.forEach(({ inputName, setterName, parentPath }) => {
    const useStateDeclaration = j.variableDeclaration('const', [
      j.variableDeclarator(
        j.arrayPattern([j.identifier(inputName), j.identifier(setterName)]),
        j.callExpression(j.identifier('useState'), [j.literal('')]),
      ),
    ]);

    j(parentPath).insertBefore(useStateDeclaration);
  });

  if (needsUseStateImport) {
    const reactImports = root.find(j.ImportDeclaration, {
      source: { value: 'react' },
    });

    if (reactImports.length > 0) {
      const firstReactImport = reactImports.at(0);
      const specifiers = firstReactImport.get().node.specifiers || [];

      const hasUseState = specifiers.some(
        (spec: any) =>
          spec.type === 'ImportSpecifier' &&
          spec.imported.type === 'Identifier' &&
          spec.imported.name === 'useState',
      );

      if (!hasUseState) {
        specifiers.push(j.importSpecifier(j.identifier('useState')));
      }
    } else {
      const imports = root.find(j.ImportDeclaration);
      if (imports.length > 0) {
        imports
          .at(0)
          .insertAfter(
            j.importDeclaration(
              [j.importSpecifier(j.identifier('useState'))],
              j.literal('react'),
            ),
          );
      }
    }
  }
});
