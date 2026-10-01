const { createMacro } = require('babel-plugin-macros');

// copy to:
// https://astexplorer.net/#/gist/642aebbb9e449e959f4ad8907b4adf3a/4a65742e2a3e926eb55eaa3d657d1472b9ac7970
module.exports = createMacro(ICUMacro);

function ICUMacro({ references, state, babel }) {
  const {
    Trans = [],
    Plural = [],
    Select = [],
    SelectOrdinal = [],
    number = [],
    date = [],
    select = [],
    selectOrdinal = [],
    plural = [],
    time = [],
  } = references;

  // assert we have the react-i18next IcuTrans component imported
  addNeededImports(state, babel, references);

  // transform Plural and SelectOrdinal
  [...Plural, ...SelectOrdinal].forEach((referencePath) => {
    if (referencePath.parentPath.type === 'JSXOpeningElement') {
      pluralAsJSX(
        referencePath.parentPath,
        {
          attributes: referencePath.parentPath.get('attributes'),
          children: referencePath.parentPath.parentPath.get('children'),
        },
        babel,
      );
    } else {
      // throw a helpful error message or something :)
    }
  });

  // transform Select
  Select.forEach((referencePath) => {
    if (referencePath.parentPath.type === 'JSXOpeningElement') {
      selectAsJSX(
        referencePath.parentPath,
        {
          attributes: referencePath.parentPath.get('attributes'),
          children: referencePath.parentPath.parentPath.get('children'),
        },
        babel,
      );
    } else {
      // throw a helpful error message or something :)
    }
  });

  // transform Trans
  Trans.forEach((referencePath) => {
    if (referencePath.parentPath.type === 'JSXOpeningElement') {
      transAsJSX(
        referencePath.parentPath,
        {
          attributes: referencePath.parentPath.get('attributes'),
          children: referencePath.parentPath.parentPath.get('children'),
        },
        babel,
      );
    } else {
      // throw a helpful error message or something :)
    }
  });

  // check for number`` and others outside of <Trans>
  Object.entries({
    number,
    date,
    time,
    select,
    plural,
    selectOrdinal,
  }).forEach(([name, node]) => {
    node.forEach((item) => {
      let f = item.parentPath;
      while (f) {
        if (babel.types.isJSXElement(f.node)) {
          const { openingElement } = f.node;
          const elementName = openingElement.name;
          const isMemberExpression = babel.types.isJSXMemberExpression(elementName);

          if (
            !isMemberExpression &&
            (elementName.name === 'IcuTrans' || elementName.name === 'Trans')
          ) {
            // this is a valid use of number/date/time/etc.
            // Check for both IcuTrans (after transformation) and Trans (during transformation)
            return;
          }
        }
        f = f.parentPath;
      }
      const { loc } = item.node;
      if (!loc) {
        throw new Error(`"${name}\`\`" can only be used inside <Trans> in "unknown file"`);
      }
      throw new Error(
        `"${name}\`\`" can only be used inside <Trans> in "${loc.filename}" on line ${loc.start.line}`,
      );
    });
  });
}

function pluralAsJSX(parentPath, { attributes }, babel) {
  const t = babel.types;
  const toObjectProperty = (name, value) =>
    t.objectProperty(t.identifier(name), t.identifier(name), false, !value);

  // plural or selectordinal
  const nodeName = parentPath.node.name.name.toLocaleLowerCase();

  // will need to merge count attribute with existing values attribute in some cases
  const existingValuesAttribute = findAttribute('values', attributes);
  const existingValues = existingValuesAttribute
    ? existingValuesAttribute.node.value.expression.properties
    : [];

  let componentStartIndex = 0;
  const extracted = attributes.reduce(
    (mem, attr) => {
      if (attr.node.name.name === 'i18nKey') {
        // copy the i18nKey
        mem.attributesToCopy.push(attr.node);
      } else if (attr.node.name.name === 'count') {
        // take the count for element
        let exprName = attr.node.value.expression.name;
        if (!exprName) {
          exprName = 'count';
        }
        if (exprName === 'count') {
          // if the prop expression name is also "count", copy it instead: <Plural count={count} --> <IcuTrans count={count}
          mem.attributesToCopy.push(attr.node);
        } else {
          mem.values.unshift(toObjectProperty(exprName));
        }
        mem.defaults = `{${exprName}, ${nodeName}, ${mem.defaults}`;
      } else if (attr.node.name.name === 'values') {
        // skip the values attribute, as it has already been processed into mem from existingValues
      } else if (attr.node.value.type === 'StringLiteral') {
        // take any string node as plural option
        let pluralForm = attr.node.name.name;
        if (pluralForm.indexOf('$') === 0) pluralForm = pluralForm.replace('$', '=');
        mem.defaults = `${mem.defaults} ${pluralForm} {${attr.node.value.value}}`;
      } else if (attr.node.value.type === 'JSXExpressionContainer') {
        // convert any Trans component to plural option extracting any values and components
        const children = attr.node.value.expression.children || [];
        const thisTrans = processTrans(children, babel, componentStartIndex);

        let pluralForm = attr.node.name.name;
        if (pluralForm.indexOf('$') === 0) pluralForm = pluralForm.replace('$', '=');

        mem.defaults = `${mem.defaults} ${pluralForm} {${thisTrans.defaults}}`;
        mem.components = mem.components.concat(thisTrans.components);

        componentStartIndex += thisTrans.components.length;
      }
      return mem;
    },
    { attributesToCopy: [], values: existingValues, components: [], defaults: '' },
  );

  // replace the node with the new IcuTrans
  parentPath.replaceWith(buildTransElement(extracted, extracted.attributesToCopy, t, true));
}

function selectAsJSX(parentPath, { attributes }, babel) {
  const t = babel.types;
  const toObjectProperty = (name, value) =>
    t.objectProperty(t.identifier(name), t.identifier(name), false, !value);

  // will need to merge switch attribute with existing values attribute
  const existingValuesAttribute = findAttribute('values', attributes);
  const existingValues = existingValuesAttribute
    ? existingValuesAttribute.node.value.expression.properties
    : [];

  let componentStartIndex = 0;

  const extracted = attributes.reduce(
    (mem, attr) => {
      if (attr.node.name.name === 'i18nKey') {
        // copy the i18nKey
        mem.attributesToCopy.push(attr.node);
      } else if (attr.node.name.name === 'switch') {
        // take the switch for select element
        let exprName = attr.node.value.expression.name;
        if (!exprName) {
          exprName = 'selectKey';
          mem.values.unshift(t.objectProperty(t.identifier(exprName), attr.node.value.expression));
        } else {
          mem.values.unshift(toObjectProperty(exprName));
        }
        mem.defaults = `{${exprName}, select, ${mem.defaults}`;
      } else if (attr.node.name.name === 'values') {
        // skip the values attribute, as it has already been processed into mem as existingValues
      } else if (attr.node.value.type === 'StringLiteral') {
        // take any string node as select option
        mem.defaults = `${mem.defaults} ${attr.node.name.name} {${attr.node.value.value}}`;
      } else if (attr.node.value.type === 'JSXExpressionContainer') {
        // convert any Trans component to select option extracting any values and components
        const children = attr.node.value.expression.children || [];
        const thisTrans = processTrans(children, babel, componentStartIndex);

        mem.defaults = `${mem.defaults} ${attr.node.name.name} {${thisTrans.defaults}}`;
        mem.components = mem.components.concat(thisTrans.components);

        componentStartIndex += thisTrans.components.length;
      }
      return mem;
    },
    { attributesToCopy: [], values: existingValues, components: [], defaults: '' },
  );

  // replace the node with the new IcuTrans
  parentPath.replaceWith(buildTransElement(extracted, extracted.attributesToCopy, t, true));
}

function transAsJSX(parentPath, { attributes, children }, babel) {
  const defaultsAttr = findAttribute('defaults', attributes);
  const contentAttr = findAttribute('content', attributes);
  const componentsAttr = findAttribute('components', attributes);
  // if there is "defaults" attribute and no "content"/"components" attribute, parse defaults and extract from the parsed defaults instead of children
  // if a "content" or "components" attribute has been provided, we assume they have already constructed a valid "defaults" and it does not need to be parsed
  const parseDefaults = defaultsAttr && !contentAttr && !componentsAttr;

  let extracted;
  if (parseDefaults) {
    const defaultsExpression = defaultsAttr.node.value.value;
    const parsed = babel.parse(`<>${defaultsExpression}</>`, {
      presets: ['@babel/react'],
      filename: babel.state?.filename || 'unknown',
    }).program.body[0].expression.children;

    extracted = processTrans(parsed, babel);
  } else {
    extracted = processTrans(children, babel);
  }

  let clonedAttributes = cloneExistingAttributes(attributes);
  if (parseDefaults) {
    // remove existing defaults so it can be replaced later with the new parsed defaults
    clonedAttributes = clonedAttributes.filter((node) => node.name.name !== 'defaults');
  }

  // replace the node with the new IcuTrans
  const replacePath = children.length ? children[0].parentPath : parentPath;
  replacePath.replaceWith(
    buildTransElement(extracted, clonedAttributes, babel.types, false, !!children.length),
  );
}

function buildTransElement(
  extracted,
  finalAttributes,
  t,
  closeDefaults = false,
  wasElementWithChildren = false,
) {
  const nodeName = t.jSXIdentifier('IcuTrans');

  // plural, select open { but do not close it while reduce
  if (closeDefaults) extracted.defaults += '}';

  // convert JSX elements to declaration objects: { type: Component, props: {...} }
  const contentDeclarations = extracted.components.map((component) =>
    jsxElementToDeclaration(component, t),
  );

  const content = t.arrayExpression(contentDeclarations);
  const values = t.objectExpression(extracted.values);

  // add generated IcuTrans attributes
  if (!attributeExistsAlready('defaultTranslation', finalAttributes)) {
    if (extracted.defaults.includes('"')) {
      // wrap defaultTranslation that contains double quotes in expression container
      finalAttributes.push(
        t.jSXAttribute(
          t.jSXIdentifier('defaultTranslation'),
          t.jSXExpressionContainer(t.stringLiteral(extracted.defaults)),
        ),
      );
    } else {
      finalAttributes.push(
        t.jSXAttribute(t.jSXIdentifier('defaultTranslation'), t.stringLiteral(extracted.defaults)),
      );
    }
  }

  if (!attributeExistsAlready('content', finalAttributes))
    finalAttributes.push(
      t.jSXAttribute(t.jSXIdentifier('content'), t.jSXExpressionContainer(content)),
    );

  if (!attributeExistsAlready('values', finalAttributes))
    finalAttributes.push(
      t.jSXAttribute(t.jSXIdentifier('values'), t.jSXExpressionContainer(values)),
    );

  // create selfclosing IcuTrans component
  const openElement = t.jSXOpeningElement(nodeName, finalAttributes, true);
  if (!wasElementWithChildren) return openElement;

  return t.jSXElement(openElement, null, [], true);
}

/**
 * Convert a JSX element to a declaration object: { type: Component, props: {...} }
 */
function jsxElementToDeclaration(jsxElement, t) {
  // Handle case where jsxElement is not actually a JSXElement
  if (!jsxElement || !jsxElement.openingElement) {
    console.error('Invalid JSXElement passed to jsxElementToDeclaration:', jsxElement);
    return t.objectExpression([t.objectProperty(t.identifier('type'), t.stringLiteral('div'))]);
  }

  const elementName = jsxElement.openingElement.name;

  // Get the type - either a string for HTML elements or identifier for components
  let typeValue;

  if (t.isJSXIdentifier(elementName)) {
    // For HTML elements like 'div', 'strong', use string literal
    if (elementName.name.toLowerCase() === elementName.name) {
      typeValue = t.stringLiteral(elementName.name);
    } else {
      // For React components, use identifier
      typeValue = t.identifier(elementName.name);
    }
  } else if (t.isJSXMemberExpression(elementName)) {
    // For member expressions like Icon.Svg
    const objectName = t.isJSXIdentifier(elementName.object) ? elementName.object.name : 'unknown';
    const propertyName = elementName.property.name;

    typeValue = t.memberExpression(t.identifier(objectName), t.identifier(propertyName));
  } else {
    // Fallback
    typeValue = t.stringLiteral('div');
  }

  const properties = [t.objectProperty(t.identifier('type'), typeValue)];

  // Convert JSX attributes to props object
  const propsProperties = [];

  jsxElement.openingElement.attributes.forEach((attr) => {
    if (t.isJSXAttribute(attr)) {
      const propName = t.isJSXIdentifier(attr.name) ? attr.name.name : String(attr.name);

      let propValue;

      if (attr.value === null) {
        // Boolean prop like <Component disabled />
        propValue = t.booleanLiteral(true);
      } else if (t.isStringLiteral(attr.value)) {
        propValue = attr.value;
      } else if (t.isJSXExpressionContainer(attr.value)) {
        propValue = attr.value.expression;
      } else {
        // fallback
        propValue = t.nullLiteral();
      }

      // Use string literal for keys that aren't valid identifiers (e.g., contain hyphens)
      const propKey = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(propName)
        ? t.identifier(propName)
        : t.stringLiteral(propName);

      propsProperties.push(t.objectProperty(propKey, propValue));
    } else if (t.isJSXSpreadAttribute(attr)) {
      // Handle spread attributes like {...spreadProps}
      propsProperties.push(t.spreadElement(attr.argument));
    }
  });

  // Handle nested children if any
  if (jsxElement.children && jsxElement.children.length > 0) {
    const childDeclarations = jsxElement.children
      .filter((child) =>
        // Only include JSXElements in the declaration tree
        // JSXText content is already captured in the defaults string
        t.isJSXElement(child),
      )
      .map((child) => jsxElementToDeclaration(child, t));

    if (childDeclarations.length > 0) {
      propsProperties.push(
        t.objectProperty(t.identifier('children'), t.arrayExpression(childDeclarations)),
      );
    }
  }

  if (propsProperties.length > 0) {
    properties.push(t.objectProperty(t.identifier('props'), t.objectExpression(propsProperties)));
  }

  return t.objectExpression(properties);
}

function cloneExistingAttributes(attributes) {
  return attributes.reduce((mem, attr) => {
    const node = attr.node ? attr.node : attr;

    // Skip 'defaults' attribute as we're replacing it with 'defaultTranslation'
    if (node.type === 'JSXAttribute' && node.name && node.name.name === 'defaults') {
      return mem;
    }

    // Skip 'components' attribute as we're replacing it with 'content'
    if (node.type === 'JSXAttribute' && node.name && node.name.name === 'components') {
      return mem;
    }

    mem.push(node);
    return mem;
  }, []);
}

function findAttribute(name, attributes) {
  return attributes.find((child) => {
    const ele = child.node ? child.node : child;
    return ele.name.name === name;
  });
}

function attributeExistsAlready(name, attributes) {
  return !!findAttribute(name, attributes);
}

function processTrans(children, babel, componentStartIndex = 0) {
  const res = {};

  res.defaults = mergeChildren(children, babel, componentStartIndex);
  res.components = getComponents(children, babel);
  res.values = getValues(children, babel);

  return res;
}

const leadingNewLineAndWhitespace = /^\n\s+/g;
const trailingNewLineAndWhitespace = /\n\s+$/g;
function trimIndent(text) {
  const newText = text
    .replace(leadingNewLineAndWhitespace, '')
    .replace(trailingNewLineAndWhitespace, '');
  return newText;
}

/**
 * add comma-delimited expressions like `{ val, number }`
 */
function mergeCommaExpressions(ele) {
  if (ele.expression && ele.expression.expressions) {
    return `{${ele.expression.expressions
      .reduce((m, i) => {
        m.push(i.name || i.value);
        return m;
      }, [])
      .join(', ')}}`;
  }
  return '';
}

/**
 * this is for supporting complex icu type interpolations
 * date`${variable}` and number`{${varName}, ::percent}`
 * also, plural`{${count}, one { ... } other { ... }}
 */
function mergeTaggedTemplateExpressions(ele, componentFoundIndex, t, babel) {
  if (t.isTaggedTemplateExpression(ele.expression)) {
    const [, text, index] = getTextAndInterpolatedVariables(
      ele.expression.tag.name,
      ele.expression,
      componentFoundIndex,
      babel,
    );
    return [text, index];
  }
  return ['', componentFoundIndex];
}

function mergeChildren(children, babel, componentStartIndex = 0) {
  const t = babel.types;
  let componentFoundIndex = componentStartIndex;

  return children.reduce((mem, child) => {
    const ele = child.node ? child.node : child;
    let result = mem;

    // add text, but trim indentation whitespace
    if (t.isJSXText(ele) && ele.value) result += trimIndent(ele.value);
    // add ?!? forgot
    if (ele.expression && ele.expression.value) result += ele.expression.value;
    // add `{ val }`
    if (ele.expression && ele.expression.name) result += `{${ele.expression.name}}`;
    // add `{ val, number }`
    result += mergeCommaExpressions(ele);
    const [nextText, newIndex] = mergeTaggedTemplateExpressions(ele, componentFoundIndex, t, babel);
    result += nextText;
    componentFoundIndex = newIndex;
    // add <strong>...</strong> with replace to <0>inner string</0>
    if (t.isJSXElement(ele)) {
      result += `<${componentFoundIndex}>${mergeChildren(
        ele.children,
        babel,
      )}</${componentFoundIndex}>`;
      componentFoundIndex += 1;
    }

    return result;
  }, '');
}

const extractTaggedTemplateValues = (ele, babel, toObjectProperty) => {
  // date`${variable}` and so on
  if (ele.expression && ele.expression.type === 'TaggedTemplateExpression') {
    const [variables] = getTextAndInterpolatedVariables(
      ele.expression.tag.name,
      ele.expression,
      0,
      babel,
    );
    return variables.map((vari) => toObjectProperty(vari));
  }
  return [];
};

/**
 * Extract the names of interpolated value as object properties to pass to IcuTrans
 */
function getValues(children, babel) {
  const t = babel.types;
  const toObjectProperty = (name, value) =>
    t.objectProperty(t.identifier(name), t.identifier(name), false, !value);

  return children.reduce((mem, child) => {
    const ele = child.node ? child.node : child;
    let result = mem;

    // add `{ var }` to values
    if (ele.expression && ele.expression.name) mem.push(toObjectProperty(ele.expression.name));
    // add `{ var, number }` to values
    if (ele.expression && ele.expression.expressions)
      result.push(
        toObjectProperty(ele.expression.expressions[0].name || ele.expression.expressions[0].value),
      );
    // add `{ var: 'bar' }` to values
    if (ele.expression && ele.expression.properties)
      result = result.concat(ele.expression.properties);
    // date`${variable}` and so on
    result = result.concat(extractTaggedTemplateValues(ele, babel, toObjectProperty));
    // recursive add inner elements stuff to values
    if (t.isJSXElement(ele)) {
      result = result.concat(getValues(ele.children, babel));
    }

    return result;
  }, []);
}

/**
 * Common logic for adding a child element of Trans to the list of components to hydrate the translation
 * @param {JSXElement} jsxElement
 * @param {JSXElement[]} mem
 */
const processJSXElement = (jsxElement, mem, t) => {
  const clone = t.clone(jsxElement);
  clone.children = clone.children.reduce((clonedMem, clonedChild) => {
    const clonedEle = clonedChild.node ? clonedChild.node : clonedChild;

    // clean out invalid definitions by replacing `{ catchDate, date, short }` with `{ catchDate }`
    if (clonedEle.expression && clonedEle.expression.expressions)
      clonedEle.expression.expressions = [clonedEle.expression.expressions[0]];

    clonedMem.push(clonedChild);
    return clonedMem;
  }, []);

  mem.push(jsxElement);
};

/**
 * Extract the React components to pass to IcuTrans as content
 */
function getComponents(children, babel) {
  const t = babel.types;

  return children.reduce((mem, child) => {
    const ele = child.node ? child.node : child;

    if (t.isJSXExpressionContainer(ele)) {
      // check for date`` and so on
      if (t.isTaggedTemplateExpression(ele.expression)) {
        ele.expression.quasi.expressions.forEach((expr) => {
          // check for sub-expressions. This can happen with plural`` or select`` or selectOrdinal``
          // these can have nested components
          if (t.isTaggedTemplateExpression(expr) && expr.quasi.expressions.length) {
            mem.push(...getComponents(expr.quasi.expressions, babel));
          }
          if (!t.isJSXElement(expr)) {
            // ignore anything that is not a component
            return;
          }
          processJSXElement(expr, mem, t);
        });
      }
    }
    if (t.isJSXElement(ele)) {
      processJSXElement(ele, mem, t);
    }

    return mem;
  }, []);
}

const icuInterpolators = ['date', 'time', 'number', 'plural', 'select', 'selectOrdinal'];
const importsToAdd = ['IcuTrans'];

/**
 * helper split out of addNeededImports to make codeclimate happy
 *
 * This does the work of amending an existing import from "react-i18next", or
 * creating a new one if it doesn't exist
 */
function addImports(state, existingImport, allImportsToAdd, t) {
  // append imports to existing or add a new react-i18next import for the IcuTrans and icu tagged template literals
  if (existingImport) {
    allImportsToAdd.forEach((name) => {
      if (
        existingImport.specifiers.findIndex(
          (specifier) => specifier.imported && specifier.imported.name === name,
        ) === -1
      ) {
        existingImport.specifiers.push(t.importSpecifier(t.identifier(name), t.identifier(name)));
      }
    });
  } else {
    state.file.path.node.body.unshift(
      t.importDeclaration(
        allImportsToAdd.map((name) => t.importSpecifier(t.identifier(name), t.identifier(name))),
        t.stringLiteral('react-i18next'),
      ),
    );
  }
}

/**
 * Add `import { IcuTrans, number, date, <etc.> } from "react-i18next"` as needed
 */
function addNeededImports(state, babel, references) {
  const t = babel.types;

  // check if there is an existing react-i18next import
  const existingImport = state.file.path.node.body.find(
    (importNode) =>
      t.isImportDeclaration(importNode) && importNode.source.value === 'react-i18next',
  );
  // check for any of the tagged template literals that are used in the source, and add them
  const usedRefs = Object.keys(references).filter((importName) => {
    if (!icuInterpolators.includes(importName)) {
      return false;
    }
    return references[importName].length;
  });

  // combine IcuTrans + any tagged template literals
  const allImportsToAdd = importsToAdd.concat(usedRefs);

  addImports(state, existingImport, allImportsToAdd, t);
}

/**
 * iterate over a node detected inside a tagged template literal
 *
 * This is a helper function for `extractVariableNamesFromQuasiNodes` defined below
 *
 * this is called using reduce as a way of tricking what would be `.map()`
 * into passing in the parameters needed to both modify `componentFoundIndex`,
 * `stringOutput`, and `interpolatedVariableNames`
 * and to pass in the dependencies babel, and type. Type is the template type.
 * For "date``" the type will be `date`. for "number``" the type is `number`, etc.
 */
const extractNestedTemplatesAndComponents = (
  { componentFoundIndex: lastIndex, babel, stringOutput, type, interpolatedVariableNames },
  node,
) => {
  let componentFoundIndex = lastIndex;
  if (node.type === 'JSXElement') {
    // perform the interpolation of components just as we do in a normal Trans setting
    const subText = `<${componentFoundIndex}>${mergeChildren(
      node.children,
      babel,
    )}</${componentFoundIndex}>`;
    componentFoundIndex += 1;
    stringOutput.push(subText);
  } else if (node.type === 'TaggedTemplateExpression') {
    // a nested date``/number``/plural`` etc., extract whatever is inside of it
    const tagName = babel.types.isIdentifier(node.tag) && node.tag.name ? node.tag.name : 'unknown';
    const [variableNames, childText, newIndex] = getTextAndInterpolatedVariables(
      tagName,
      node,
      componentFoundIndex,
      babel,
    );
    interpolatedVariableNames.push(...variableNames);
    componentFoundIndex = newIndex;
    stringOutput.push(childText);
  } else if (node.type === 'Identifier') {
    // turn date`${thing}` into `thing, date`
    const nodeName = node.name || 'unknown';
    stringOutput.push(`${nodeName}, ${type}`);
  } else if (node.type === 'TemplateElement') {
    // convert all whitespace into a single space for the text in the tagged template literal
    const cookedValue = node.value.cooked || '';
    stringOutput.push(cookedValue.replace(/\s+/g, ' '));
  } else {
    // unknown node type, ignore
  }
  return { componentFoundIndex, babel, stringOutput, type, interpolatedVariableNames };
};

/**
 * filter the list of nodes within a tagged template literal to the 4 types we can process,
 * and ignore anything else.
 *
 * this is a helper function for `extractVariableNamesFromQuasiNodes`
 */
const filterNodes = (node) => {
  if (node.type === 'Identifier') {
    // if the node has a name, keep it
    return node.name;
  }
  if (node.type === 'JSXElement' || node.type === 'TaggedTemplateExpression') {
    // always keep interpolated elements or other tagged template literals like a nested date`` inside a plural``
    return true;
  }
  if (node.type === 'TemplateElement') {
    // return the "cooked" (escaped) text for the text in the template literal (`, ::percent` in number`${varname}, ::percent`)
    return node.value.cooked;
  }
  // unknown node type, ignore
  return false;
};

const errorOnInvalidQuasiNodes = (primaryNode) => {
  const noInterpolationError = !primaryNode.quasi.expressions.length;
  const wrongOrderError = primaryNode.quasi.quasis[0].value.raw.length;
  const tagName = primaryNode.tag.name || 'unknown';
  const message = `${tagName} argument must be interpolated ${
    noInterpolationError ? 'in' : 'at the beginning of'
  } "${tagName}\`\`" in "${primaryNode.loc?.filename}" on line ${primaryNode.loc?.start.line}`;
  if (noInterpolationError || wrongOrderError) {
    throw new Error(message);
  }
};

const extractNodeVariableNames = (varNode, babel) => {
  const interpolatedVariableNames = [];
  if (varNode.type === 'JSXElement') {
    // extract inner interpolated variables and add to the list
    interpolatedVariableNames.push(
      ...getValues(varNode.children, babel).map((value) => {
        if (babel.types.isIdentifier(value.value)) {
          return value.value.name;
        }
        return String(value.value);
      }),
    );
  } else if (varNode.type === 'Identifier') {
    // the name of the interpolated variable
    interpolatedVariableNames.push(varNode.name);
  }
  return interpolatedVariableNames;
};

const extractVariableNamesFromQuasiNodes = (primaryNode, babel) => {
  errorOnInvalidQuasiNodes(primaryNode);
  // this will contain all the nodes to convert to the ICU messageformat text
  // at first they are unsorted, but will be ordered correctly at the end of the function
  const text = [];
  // the variable names. These are converted to object references as required for the IcuTrans values
  // in getValues() (toObjectProperty helper function)
  const interpolatedVariableNames = [];
  primaryNode.quasi.expressions.forEach((varNode) => {
    if (
      !babel.types.isIdentifier(varNode) &&
      !babel.types.isTaggedTemplateExpression(varNode) &&
      !babel.types.isJSXElement(varNode)
    ) {
      const tagName = primaryNode.tag.name || 'unknown';
      throw new Error(
        `Must pass a variable, not an expression to "${tagName}\`\`" in "${primaryNode.loc?.filename}" on line ${primaryNode.loc?.start.line}`,
      );
    }
    text.push(varNode);
    interpolatedVariableNames.push(...extractNodeVariableNames(varNode, babel));
  });
  primaryNode.quasi.quasis.forEach((quasiNode) => {
    // these are the text surrounding the variable interpolation
    // so in date`${varname}, short` it would be `''` and `, short`.
    // (the empty string before `${varname}` and the stuff after it)
    text.push(quasiNode);
  });
  return { text, interpolatedVariableNames };
};

const throwOnInvalidType = (type, primaryNode) => {
  if (!icuInterpolators.includes(type)) {
    throw new Error(
      `Unsupported tagged template literal "${type}", must be one of date, time, number, plural, select, selectOrdinal in "${primaryNode.loc?.filename}" on line ${primaryNode.loc?.start.line}`,
    );
  }
};

/**
 * Retrieve the new text to use, and any interpolated variables
 *
 * This is used to process tagged template literals like date`${variable}` and number`${num}, ::percent`
 *
 * for the data example, it will return text of `{variable, date}` with a variable of `variable`
 * for the number example, it will return text of `{num, number, ::percent}` with a variable of `num`
 * @param {string} type the name of the tagged template (`date`, `number`, `plural`, etc. - any valid complex ICU type)
 * @param {TaggedTemplateExpression} primaryNode the template expression node
 * @param {int} index starting index number of components to be used for interpolations like <0>
 * @param {*} babel
 */
function getTextAndInterpolatedVariables(type, primaryNode, index, babel) {
  throwOnInvalidType(type, primaryNode);
  const componentFoundIndex = index;
  const { text, interpolatedVariableNames } = extractVariableNamesFromQuasiNodes(
    primaryNode,
    babel,
  );
  const { stringOutput, componentFoundIndex: newIndex } = text
    .filter(filterNodes)
    // sort by the order they appear in the source code
    .sort((a, b) => {
      const aStart = a.start != null ? a.start : null;
      const bStart = b.start != null ? b.start : null;
      if (aStart != null && bStart != null && aStart > bStart) return 1;
      return -1;
    })
    .reduce(extractNestedTemplatesAndComponents, {
      babel,
      componentFoundIndex,
      stringOutput: [],
      type,
      interpolatedVariableNames,
    });
  return [
    interpolatedVariableNames,
    `{${stringOutput.join('')}}`,
    // return the new component interpolation index
    newIndex,
  ];
}
