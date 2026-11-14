// @ts-check
import { valueToEstree } from 'estree-util-value-to-estree';

/**
 * @param {Object} args
 * @param {string} args.name
 * @param {unknown[]} [args.children]
 * @param {Record<string, unknown>} [args.props]
 */
export function createMdxElement({ name, children, props = {} }) {
  // Native HTML elements are rendered as regular tags
  if (name.toLowerCase() === name) {
    return {
      type: 'element',
      tagName: name,
      properties: props,
      children,
    };
  }

  return {
    type: 'mdxJsxFlowElement',
    name,
    attributes: Object.entries(props).map(([key, value]) => ({
      type: 'mdxJsxAttribute',
      name: key,
      value: getAttributeValue(value),
    })),
    data: { _mdxExplicitJsx: true },
    children,
  };
}

/**
 * @param {unknown} value
 */
function getAttributeValue(value) {
  if (typeof value === 'string') {
    return value;
  }

  return {
    type: 'mdxJsxAttributeValueExpression',
    value: JSON.stringify(value),
    data: {
      estree: {
        type: 'Program',
        body: [
          {
            type: 'ExpressionStatement',
            expression: valueToEstree(value),
          },
        ],
        sourceType: 'module',
      },
    },
  };
}
