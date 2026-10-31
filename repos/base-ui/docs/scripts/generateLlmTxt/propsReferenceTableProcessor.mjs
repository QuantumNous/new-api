/**
 * propsReferenceTableProcessor.mjs - Process inline PropsReferenceTable components
 *
 * This module handles converting inline props reference data from MDX PropsReferenceTable
 * components into markdown tables for documentation.
 */

import { unified } from 'unified';
import remarkParse from 'remark-parse';
import * as mdx from './mdxNodeHelpers.mjs';

/**
 * Parse a markdown string into an AST
 * @param {string} markdown - Markdown string to parse
 * @returns {Object} The root content node of the parsed AST
 */
function parseMarkdown(markdown) {
  // Parse markdown into an AST
  const processor = unified().use(remarkParse);
  const result = processor.parse(markdown);
  return result.children;
}

/**
 * Recursively convert an estree expression into a JavaScript object
 * @param {Object} estree - The estree node to convert
 * @returns {Object} The converted JavaScript object
 */
function convertEstreeToObject(estree) {
  // Get the main expression from the estree program body
  if (!estree || !estree.body || !estree.body[0] || !estree.body[0].expression) {
    throw new Error('Invalid estree structure - missing expression');
  }

  const expression = estree.body[0].expression;
  return convertExpressionNode(expression);
}

/**
 * Convert an expression node to a JavaScript value
 * @param {Object} node - The expression node
 * @returns {any} The converted JavaScript value
 */
function convertExpressionNode(node) {
  if (!node || !node.type) {
    throw new Error('Invalid expression node - missing type');
  }

  switch (node.type) {
    case 'ObjectExpression': {
      const obj = {};
      // Convert each property in the object
      for (const prop of node.properties) {
        if (prop.type !== 'Property') {
          throw new Error(`Unsupported property type: ${prop.type}`);
        }

        // Get the property key
        let key;
        if (prop.key.type === 'Identifier') {
          key = prop.key.name;
        } else if (prop.key.type === 'Literal') {
          key = prop.key.value;
        } else {
          throw new Error(`Unsupported key type: ${prop.key.type}`);
        }

        // Get the property value
        const value = convertExpressionNode(prop.value);

        // Add to the object
        obj[key] = value;
      }
      return obj;
    }
    case 'ArrayExpression':
      // Convert each element in the array
      return node.elements.map((element) => convertExpressionNode(element));

    case 'Literal':
      // Return literals directly
      return node.value;

    case 'TemplateLiteral':
      // For simple template literals with no expressions
      if (node.quasis.length === 1 && node.expressions.length === 0) {
        return node.quasis[0].value.raw;
      }
      // For complex template literals, return a simplified representation
      return node.quasis.map((q) => q.value.raw).join('…');

    case 'Identifier':
      // For identifiers like undefined, null, etc.
      return node.name;

    default:
      throw new Error(`Unsupported expression type: ${node.type}`);
  }
}

/**
 * Transforms a PropsReferenceTable component into a markdown table
 * @param {Object} node - The PropsReferenceTable JSX node from MDX
 * @returns {Array} Array of markdown nodes to replace the PropsReferenceTable component
 */
export function processPropsReferenceTable(node) {
  // Extract the data attribute which contains props definitions
  const dataAttr = node.attributes?.find((attr) => attr.name === 'data');
  const typeAttr = node.attributes?.find((attr) => attr.name === 'type')?.value || 'props';

  // If no data attribute is found, throw an error
  if (!dataAttr) {
    throw new Error('PropsReferenceTable: No data provided');
  }

  // Process the data object from the AST
  let propsData = {};

  if (dataAttr.type === 'mdxJsxAttribute' && dataAttr.value) {
    try {
      if (
        dataAttr.value.type === 'mdxJsxAttributeValueExpression' &&
        dataAttr.value.data &&
        dataAttr.value.data.estree
      ) {
        // Convert the estree to a JavaScript object
        propsData = convertEstreeToObject(dataAttr.value.data.estree);
      } else {
        throw new Error('PropsReferenceTable data must be a static JavaScript object');
      }
    } catch (err) {
      throw new Error(`Error processing PropsReferenceTable data: ${err.message}`);
    }
  } else {
    throw new Error('PropsReferenceTable data attribute must be a valid JSX attribute');
  }

  // Generate markdown tables
  const tables = [];

  // Add heading based on the type
  const heading = typeAttr === 'return' ? 'Return Value' : 'Props';
  tables.push(mdx.paragraph([mdx.strong(`${heading}:`)]));

  // Convert props data to table rows
  const propsRows = Object.entries(propsData).map(([propName, propDef]) => {
    const row = [propName, propDef.type ? mdx.inlineCode(propDef.type) : '-'];

    // Add default column for props type
    if (typeAttr === 'props') {
      row.push(propDef.default ? mdx.inlineCode(propDef.default) : '-');
    }

    // Add description
    row.push(parseMarkdown(propDef.description || '-'));

    return row;
  });

  // Define columns based on type
  const headers =
    typeAttr === 'props'
      ? ['Prop', 'Type', 'Default', 'Description']
      : ['Property', 'Type', 'Description'];

  // Define column alignments
  const alignments =
    typeAttr === 'props' ? ['left', 'left', 'left', 'left'] : ['left', 'left', 'left'];

  const tableNode = mdx.table(headers, propsRows, alignments);
  tables.push(tableNode);

  return tables;
}
