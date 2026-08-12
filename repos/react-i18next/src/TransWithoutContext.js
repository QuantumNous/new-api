import { Fragment, isValidElement, cloneElement, createElement, Children } from 'react';
import { keyFromSelector } from 'i18next';
import HTML from 'html-parse-stringify';
import { isObject, isString, warn, warnOnce } from './utils.js';
import { getDefaults } from './defaults.js';
import { getI18n } from './i18nInstance.js';
import { unescape } from './unescape.js';

const hasChildren = (node, checkLength) => {
  if (!node) return false;
  const base = node.props?.children ?? node.children;
  if (checkLength) return base.length > 0;
  return !!base;
};

const getChildren = (node) => {
  if (!node) return [];
  const children = node.props?.children ?? node.children;
  return node.props?.i18nIsDynamicList ? getAsArray(children) : children;
};

const hasValidReactChildren = (children) =>
  Array.isArray(children) && children.every(isValidElement);

const getAsArray = (data) => (Array.isArray(data) ? data : [data]);

const mergeProps = (source, target) => {
  const newTarget = { ...target };
  // translation props (source.props) should override component props (target.props)
  newTarget.props = { ...target.props, ...source.props };
  return newTarget;
};

const getValuesFromChildren = (children) => {
  const values = {};
  if (!children) return values;
  const getData = (childs) => {
    const childrenArray = getAsArray(childs);
    childrenArray.forEach((child) => {
      if (isString(child)) return;
      if (hasChildren(child)) getData(getChildren(child));
      else if (isObject(child) && !isValidElement(child)) Object.assign(values, child);
    });
  };
  getData(children);
  return values;
};

export const nodesToString = (children, i18nOptions, i18n, i18nKey) => {
  if (!children) return '';
  let stringNode = '';

  // do not use `React.Children.toArray`, will fail at object children
  const childrenArray = getAsArray(children);
  const keepArray = i18nOptions?.transSupportBasicHtmlNodes
    ? (i18nOptions.transKeepBasicHtmlNodesFor ?? [])
    : [];

  // e.g. lorem <br/> ipsum {{ messageCount, format }} dolor <strong>bold</strong> amet
  childrenArray.forEach((child, childIndex) => {
    if (isString(child)) {
      // actual e.g. lorem
      // expected e.g. lorem
      stringNode += `${child}`;
      return;
    }
    if (isValidElement(child)) {
      const { props, type } = child;
      const childPropsCount = Object.keys(props).length;
      const shouldKeepChild = keepArray.indexOf(type) > -1;
      const childChildren = props.children;

      if (!childChildren && shouldKeepChild && !childPropsCount) {
        // actual e.g. lorem <br/> ipsum
        // expected e.g. lorem <br/> ipsum
        stringNode += `<${type}/>`;
        return;
      }
      if ((!childChildren && (!shouldKeepChild || childPropsCount)) || props.i18nIsDynamicList) {
        // actual e.g. lorem <hr className="test" /> ipsum
        // expected e.g. lorem <0></0> ipsum
        // or
        // we got a dynamic list like
        // e.g. <ul i18nIsDynamicList>{['a', 'b'].map(item => ( <li key={item}>{item}</li> ))}</ul>
        // expected e.g. "<0></0>", not e.g. "<0><0>a</0><1>b</1></0>"
        stringNode += `<${childIndex}></${childIndex}>`;
        return;
      }
      if (shouldKeepChild && childPropsCount <= 1) {
        // actual e.g. dolor <strong>bold</strong> amet
        // expected e.g. dolor <strong>bold</strong> amet
        const cnt = isString(childChildren)
          ? childChildren
          : nodesToString(childChildren, i18nOptions, i18n, i18nKey);
        stringNode += `<${type}>${cnt}</${type}>`;
        return;
      }
      // regular case mapping the inner children
      const content = nodesToString(childChildren, i18nOptions, i18n, i18nKey);
      stringNode += `<${childIndex}>${content}</${childIndex}>`;
      return;
    }
    if (child === null) {
      warn(i18n, 'TRANS_NULL_VALUE', `Passed in a null value as child`, { i18nKey });
      return;
    }
    if (isObject(child)) {
      // e.g. lorem {{ value, format }} ipsum
      const { format, ...clone } = child;
      const keys = Object.keys(clone);

      if (keys.length === 1) {
        const value = format ? `${keys[0]}, ${format}` : keys[0];
        stringNode += `{{${value}}}`;
        return;
      }
      warn(
        i18n,
        'TRANS_INVALID_OBJ',
        `Invalid child - Object should only have keys {{ value, format }} (format is optional).`,
        { i18nKey, child },
      );
      return;
    }
    warn(
      i18n,
      'TRANS_INVALID_VAR',
      `Passed in a variable like {number} - pass variables for interpolation as full objects like {{number}}.`,
      { i18nKey, child },
    );
  });

  return stringNode;
};

/**
 * Escape literal < characters that are not part of valid tags
 * Valid tags are: numbered tags like <0>, </0> or named tags from keepArray/knownComponents
 * @param {string} str - The string to escape
 * @param {Array<string>} keepArray - Array of HTML tag names to keep
 * @param {Object} knownComponentsMap - Map of known component names
 * @returns {string} String with literal < characters escaped
 */
const escapeLiteralLessThan = (str, keepArray = [], knownComponentsMap = {}) => {
  if (!str) return str;

  // Build a list of valid tag names (numbered indices and known component names)
  const knownNames = Object.keys(knownComponentsMap);
  const allValidNames = [...keepArray, ...knownNames];

  // Pattern to match:
  // 1. Opening tags: <number> or <name> where name is in allValidNames
  // 2. Closing tags: </number> or </name> where name is in allValidNames
  // 3. Self-closing tags: <name/> or <name /> where name is in keepArray
  // Everything else starting with < should be escaped

  let result = '';
  let i = 0;

  while (i < str.length) {
    if (str[i] === '<') {
      // Check if this is a valid tag
      let isValidTag = false;

      // Check for closing tag: </number> or </name>
      const closingMatch = str.slice(i).match(/^<\/(\d+|[a-zA-Z][a-zA-Z0-9_-]*)>/);
      if (closingMatch) {
        const tagName = closingMatch[1];
        // Valid if it's a number or in our valid names list
        if (/^\d+$/.test(tagName) || allValidNames.includes(tagName)) {
          isValidTag = true;
          result += closingMatch[0];
          i += closingMatch[0].length;
        }
      }

      // Check for opening tag: <number> or <name> or <name/> or <name />
      // Also handle tags with attributes: <0 href="..."> or <name class="...">
      if (!isValidTag) {
        // Match: <tagName [attributes] [/]>
        // Attributes pattern: name="value" or name='value' or name (boolean)
        const openingMatch = str
          .slice(i)
          .match(
            /^<(\d+|[a-zA-Z][a-zA-Z0-9_-]*)(\s+[\w-]+(?:=(?:"[^"]*"|'[^']*'|[^\s>]+))?)*\s*(\/)?>/,
          );
        if (openingMatch) {
          const tagName = openingMatch[1];
          // Valid if it's a number or in our valid names list
          if (/^\d+$/.test(tagName) || allValidNames.includes(tagName)) {
            isValidTag = true;
            result += openingMatch[0];
            i += openingMatch[0].length;
          }
        }
      }

      // If not a valid tag, escape the <
      if (!isValidTag) {
        result += '&lt;';
        i += 1;
      }
    } else {
      result += str[i];
      i += 1;
    }
  }

  return result;
};

const renderNodes = (
  children,
  knownComponentsMap,
  targetString,
  i18n,
  i18nOptions,
  combinedTOpts,
  shouldUnescape,
) => {
  if (targetString === '') return [];

  // check if contains tags we need to replace from html string to react nodes
  const keepArray = i18nOptions.transKeepBasicHtmlNodesFor || [];
  const emptyChildrenButNeedsHandling =
    targetString && new RegExp(keepArray.map((keep) => `<${keep}`).join('|')).test(targetString);

  // no need to replace tags in the targetstring
  if (!children && !knownComponentsMap && !emptyChildrenButNeedsHandling && !shouldUnescape)
    return [targetString];

  // v2 -> interpolates upfront no need for "some <0>{{var}}</0>"" -> will be just "some {{var}}" in translation file
  const data = knownComponentsMap ?? {};

  const getData = (childs) => {
    const childrenArray = getAsArray(childs);

    childrenArray.forEach((child) => {
      if (isString(child)) return;
      if (hasChildren(child)) getData(getChildren(child));
      else if (isObject(child) && !isValidElement(child)) Object.assign(data, child);
    });
  };

  getData(children);

  // Escape literal < characters that are not part of valid tags before parsing
  const escapedString = escapeLiteralLessThan(targetString, keepArray, data);

  // parse ast from string with additional wrapper tag
  // -> avoids issues in parser removing prepending text nodes
  const ast = HTML.parse(`<0>${escapedString}</0>`);
  const opts = { ...data, ...combinedTOpts };

  const renderInner = (child, node, rootReactNode) => {
    const childs = getChildren(child);
    const mappedChildren = mapAST(childs, node.children, rootReactNode);
    // `mappedChildren` will always be empty if using the `i18nIsDynamicList` prop,
    // but the children might not necessarily be react components
    return (hasValidReactChildren(childs) && mappedChildren.length === 0) ||
      child.props?.i18nIsDynamicList
      ? childs
      : mappedChildren;
  };

  const pushTranslatedJSX = (child, inner, mem, i, isVoid) => {
    if (child.dummy) {
      child.children = inner; // needed on preact!
      mem.push(cloneElement(child, { key: i }, isVoid ? undefined : inner));
    } else {
      mem.push(
        ...Children.map([child], (c) => {
          // Fragments only accept key/children (#1914), and elements carrying the internal
          // i18nIsDynamicList prop must not forward it to the DOM (#1915). cloneElement
          // cannot remove props from the merged result, so in both cases we rebuild the
          // props via createElement. Fragments can't have refs, and i18nIsDynamicList is
          // typically used on list wrappers rather than ref'd elements, so the common
          // ref-forwarding path (#1887) still goes through cloneElement below.
          if (c.type === Fragment || c.props?.i18nIsDynamicList !== undefined) {
            const freshProps = { key: i };
            if (c && c.props) {
              Object.keys(c.props).forEach((k) => {
                if (k === 'children' || k === 'i18nIsDynamicList') return;
                // On React >= 19 `ref` is a regular prop and flows through here.
                freshProps[k] = c.props[k];
              });
            }
            return createElement(c.type, freshProps, isVoid ? null : inner);
          }

          // Use cloneElement so React preserves/forwards refs internally without us
          // ever accessing element.ref or c.props.ref (avoids the React 19 warning). (#1887)
          const override = { key: i };
          if (c && c.props) {
            Object.keys(c.props).forEach((k) => {
              if (k === 'ref' || k === 'children') return;
              override[k] = c.props[k];
            });
          }
          return cloneElement(c, override, isVoid ? null : inner);
        }),
      );
    }
  };

  // reactNode (the jsx root element or child)
  // astNode (the translation string as html ast)
  // rootReactNode (the most outer jsx children array or trans components prop)
  const mapAST = (reactNode, astNode, rootReactNode) => {
    const reactNodes = getAsArray(reactNode);
    const astNodes = getAsArray(astNode);

    // Track keep-tag occurrences at this level so we can match the n-th `<p>` AST
    // node to the n-th original React element with type === 'p' (#1919).
    const keepTagOccurrence = {};

    return astNodes.reduce((mem, node, i) => {
      const translationContent =
        node.children?.[0]?.content &&
        i18n.services.interpolator.interpolate(node.children[0].content, opts, i18n.language);

      if (node.type === 'tag') {
        // regular array (components or children)
        let tmp = reactNodes[parseInt(node.name, 10)];
        if (!tmp && knownComponentsMap) tmp = knownComponentsMap[node.name];

        // trans components is an object
        if (rootReactNode.length === 1 && !tmp) tmp = rootReactNode[0][node.name];

        // neither
        if (!tmp) tmp = {};

        // should fix #1893
        const props = { ...node.attrs };
        if (shouldUnescape) {
          Object.keys(props).forEach((p) => {
            const val = props[p];
            if (isString(val)) {
              props[p] = unescape(val);
            }
          });
        }

        const child = Object.keys(props).length !== 0 ? mergeProps({ props }, tmp) : tmp;

        const isElement = isValidElement(child);

        const isValidTranslationWithChildren =
          isElement && hasChildren(node, true) && !node.voidElement;

        const isEmptyTransWithHTML =
          emptyChildrenButNeedsHandling && isObject(child) && child.dummy && !isElement;

        const isKnownComponent =
          isObject(knownComponentsMap) && Object.hasOwnProperty.call(knownComponentsMap, node.name);

        if (isString(child)) {
          const value = i18n.services.interpolator.interpolate(child, opts, i18n.language);
          mem.push(value);
        } else if (
          hasChildren(child) || // the jsx element has children -> loop
          isValidTranslationWithChildren // valid jsx element with no children but the translation has -> loop
        ) {
          const inner = renderInner(child, node, rootReactNode);
          pushTranslatedJSX(child, inner, mem, i);
        } else if (isEmptyTransWithHTML) {
          // we have a empty Trans node (the dummy element) with a targetstring that contains html tags needing
          // conversion to react nodes
          // so we just need to map the inner stuff
          const inner = mapAST(
            reactNodes /* wrong but we need something */,
            node.children,
            rootReactNode,
          );
          pushTranslatedJSX(child, inner, mem, i);
        } else if (Number.isNaN(parseFloat(node.name))) {
          if (isKnownComponent) {
            const inner = renderInner(child, node, rootReactNode);
            pushTranslatedJSX(child, inner, mem, i, node.voidElement);
          } else if (i18nOptions.transSupportBasicHtmlNodes && keepArray.indexOf(node.name) > -1) {
            if (node.voidElement) {
              mem.push(createElement(node.name, { key: `${node.name}-${i}` }));
            } else {
              // Find the matching React element by tag name (positional among
              // same-named keep-tags at this level) so its children become the
              // scope for any indexed <N> placeholders nested inside. Without
              // this, `<N>` would be looked up in the parent scope. (#1919)
              const occurrence = keepTagOccurrence[node.name] || 0;
              keepTagOccurrence[node.name] = occurrence + 1;
              let matched;
              let seen = 0;
              for (let r = 0; r < reactNodes.length; r += 1) {
                const rn = reactNodes[r];
                if (isValidElement(rn) && rn.type === node.name) {
                  if (seen === occurrence) {
                    matched = rn;
                    break;
                  }
                  seen += 1;
                }
              }
              const innerScope = matched ? getAsArray(getChildren(matched)) : reactNodes;
              const inner = mapAST(innerScope, node.children, rootReactNode);

              mem.push(createElement(node.name, { key: `${node.name}-${i}` }, inner));
            }
          } else if (node.voidElement) {
            mem.push(`<${node.name} />`);
          } else {
            const inner = mapAST(
              reactNodes /* wrong but we need something */,
              node.children,
              rootReactNode,
            );

            mem.push(`<${node.name}>${inner}</${node.name}>`);
          }
        } else if (isObject(child) && !isElement) {
          const content = node.children[0] ? translationContent : null;

          // v1
          // as interpolation was done already we just have a regular content node
          // in the translation AST while having an object in reactNodes
          // -> push the content no need to interpolate again
          if (content) mem.push(content);
        } else {
          // If component does not have children, but translation - has
          // with this in component could be components={[<span class='make-beautiful'/>]} and in translation - 'some text <0>some highlighted message</0>'
          pushTranslatedJSX(
            child,
            translationContent,
            mem,
            i,
            node.children.length !== 1 || !translationContent,
          );
        }
      } else if (node.type === 'text') {
        const wrapTextNodes = i18nOptions.transWrapTextNodes;
        const unescapeFn =
          typeof i18nOptions.unescape === 'function'
            ? i18nOptions.unescape
            : getDefaults().unescape;
        const content = shouldUnescape
          ? unescapeFn(i18n.services.interpolator.interpolate(node.content, opts, i18n.language))
          : i18n.services.interpolator.interpolate(node.content, opts, i18n.language);
        if (wrapTextNodes) {
          mem.push(createElement(wrapTextNodes, { key: `${node.name}-${i}` }, content));
        } else {
          mem.push(content);
        }
      }
      return mem;
    }, []);
  };

  // call mapAST with having react nodes nested into additional node like
  // we did for the string ast from translation
  // return the children of that extra node to get expected result
  const result = mapAST(
    [{ dummy: true, children: children || [] }],
    ast,
    getAsArray(children || []),
  );
  return getChildren(result[0]);
};

const fixComponentProps = (component, index, translation) => {
  const componentKey = component.key || index;
  const comp = cloneElement(component, { key: componentKey });
  if (
    !comp.props ||
    !comp.props.children ||
    (translation.indexOf(`${index}/>`) < 0 && translation.indexOf(`${index} />`) < 0)
  ) {
    return comp;
  }

  function Componentized() {
    // <>{comp}</>
    return createElement(Fragment, null, comp);
  }
  // <Componentized />
  return createElement(Componentized, { key: componentKey });
};

const generateArrayComponents = (components, translation) =>
  components.map((c, index) => fixComponentProps(c, index, translation));

const generateObjectComponents = (components, translation) => {
  const componentMap = {};

  Object.keys(components).forEach((c) => {
    Object.assign(componentMap, {
      [c]: fixComponentProps(components[c], c, translation),
    });
  });

  return componentMap;
};

const generateComponents = (components, translation, i18n, i18nKey) => {
  if (!components) return null;

  // components could be either an array or an object

  if (Array.isArray(components)) {
    return generateArrayComponents(components, translation);
  }

  if (isObject(components)) {
    return generateObjectComponents(components, translation);
  }

  // if components is not an array or an object, warn the user
  // and return null
  warnOnce(
    i18n,
    'TRANS_INVALID_COMPONENTS',
    `<Trans /> "components" prop expects an object or array`,
    { i18nKey },
  );
  return null;
};

// A component map is an object like: { Button: <button> }, but not an object like { 1: <button> }
const isComponentsMap = (object) => {
  if (!isObject(object)) return false;
  if (Array.isArray(object)) return false;
  return Object.keys(object).reduce(
    (acc, key) => acc && Number.isNaN(Number.parseFloat(key)),
    true,
  );
};

export function Trans({
  children,
  count,
  parent,
  i18nKey,
  context,
  tOptions = {},
  values,
  defaults,
  components,
  ns,
  i18n: i18nFromProps,
  t: tFromProps,
  shouldUnescape,
  ...additionalProps
}) {
  const i18n = i18nFromProps || getI18n();

  if (!i18n) {
    warnOnce(
      i18n,
      'NO_I18NEXT_INSTANCE',
      `Trans: You need to pass in an i18next instance using i18nextReactModule`,
      { i18nKey },
    );
    return children;
  }

  const t = tFromProps || i18n.t.bind(i18n) || ((k) => k);

  const reactI18nextOptions = { ...getDefaults(), ...i18n.options?.react };

  // prepare having a namespace
  let namespaces = ns || t.ns || i18n.options?.defaultNS;
  namespaces = isString(namespaces) ? [namespaces] : namespaces || ['translation'];

  const { transDefaultProps } = reactI18nextOptions;
  const mergedTOptions = transDefaultProps?.tOptions
    ? { ...transDefaultProps.tOptions, ...tOptions }
    : tOptions;

  const mergedShouldUnescape = shouldUnescape ?? transDefaultProps?.shouldUnescape;

  const mergedValues = transDefaultProps?.values
    ? { ...transDefaultProps.values, ...values }
    : values;

  const mergedComponents = transDefaultProps?.components
    ? { ...transDefaultProps.components, ...components }
    : components;

  const nodeAsString = nodesToString(children, reactI18nextOptions, i18n, i18nKey);
  const defaultValue =
    defaults ||
    mergedTOptions?.defaultValue ||
    nodeAsString ||
    reactI18nextOptions.transEmptyNodeValue ||
    (typeof i18nKey === 'function' ? keyFromSelector(i18nKey) : i18nKey);
  const { hashTransKey } = reactI18nextOptions;
  const key =
    i18nKey ||
    (hashTransKey ? hashTransKey(nodeAsString || defaultValue) : nodeAsString || defaultValue);
  if (i18n.options?.interpolation?.defaultVariables) {
    // eslint-disable-next-line no-param-reassign
    values =
      mergedValues && Object.keys(mergedValues).length > 0
        ? { ...mergedValues, ...i18n.options.interpolation.defaultVariables }
        : { ...i18n.options.interpolation.defaultVariables };
  } else {
    // eslint-disable-next-line no-param-reassign
    values = mergedValues;
  }

  const valuesFromChildren = getValuesFromChildren(children);

  if (valuesFromChildren && typeof valuesFromChildren.count === 'number' && count === undefined) {
    // eslint-disable-next-line no-param-reassign
    count = valuesFromChildren.count;
  }

  const interpolationOverride =
    values ||
    (count !== undefined && !i18n.options?.interpolation?.alwaysFormat) || // https://github.com/i18next/react-i18next/issues/1719 + https://github.com/i18next/react-i18next/issues/1801
    !children // if !children gets problems in future, undo that fix: https://github.com/i18next/react-i18next/issues/1729 by removing !children from this condition
      ? mergedTOptions.interpolation
      : { interpolation: { ...mergedTOptions.interpolation, prefix: '#$?', suffix: '?$#' } };
  const combinedTOpts = {
    ...mergedTOptions,
    context: context || mergedTOptions.context, // Add `context` from the props or fallback to the value from `tOptions`
    count,
    ...values,
    ...interpolationOverride,
    defaultValue,
    ns: namespaces,
  };
  let translation = key ? t(key, combinedTOpts) : defaultValue;
  if (translation === key && defaultValue) translation = defaultValue;

  const generatedComponents = generateComponents(mergedComponents, translation, i18n, i18nKey);
  let indexedChildren = generatedComponents || children;
  let componentsMap = null;
  if (isComponentsMap(generatedComponents)) {
    componentsMap = generatedComponents;
    indexedChildren = children;
  }

  const content = renderNodes(
    indexedChildren,
    componentsMap,
    translation,
    i18n,
    reactI18nextOptions,
    combinedTOpts,
    mergedShouldUnescape,
  );

  // allows user to pass `null` to `parent`
  // and override `defaultTransParent` if is present
  const useAsParent = parent ?? reactI18nextOptions.defaultTransParent;

  return useAsParent ? createElement(useAsParent, additionalProps, content) : content;
}
