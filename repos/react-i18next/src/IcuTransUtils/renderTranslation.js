import React from 'react';

import { TranslationParserError } from './TranslationParserError.js';
import { tokenize } from './tokenizer.js';
import { decodeHtmlEntities } from './htmlEntityDecoder.js';

/**
 * Render a React element tree from a declaration node and its children
 *
 * @param {Object} declaration - The component declaration (type + props)
 * @param {Array<React.ReactNode>} children - Array of child nodes (text, numbers, React elements)
 * @param {Array<Object>} [childDeclarations] - Optional array of child declarations to use for nested rendering
 * @returns {React.ReactElement} A React element
 */
const renderDeclarationNode = (declaration, children, childDeclarations) => {
  const { type, props = {} } = declaration;

  // If props contain a children declaration AND we have childDeclarations to work with,
  // we need to recursively render the content with those child declarations
  if (props.children && Array.isArray(props.children) && childDeclarations) {
    // The children array contains the parsed content from inside this tag
    // We need to rebuild the translation string and re-parse it with child declarations
    // For now, we'll use the children directly as they're already parsed
    // This happens when renderTranslation is called recursively

    // Remove children from props since we'll pass them as the third argument
    // eslint-disable-next-line no-unused-vars
    const { children: _childrenToRemove, ...propsWithoutChildren } = props;

    return React.createElement(type, propsWithoutChildren, ...children);
  }

  // Standard rendering with children from translation
  if (children.length === 0) {
    return React.createElement(type, props);
  }
  if (children.length === 1) {
    return React.createElement(type, props, children[0]);
  }
  return React.createElement(type, props, ...children);
};

/**
 * Render translation string with declaration tree to create React elements
 *
 * This function parses an ICU format translation string and reconstructs
 * a React element tree using the provided declaration tree. It replaces
 * numbered tags (e.g., <0>, <1>) with the corresponding components from
 * the declaration array and fills them with the translated text.
 *
 * @param {string} translation - ICU format string (e.g., "<0>Click here</0>")
 * @param {Array<Object>} [declarations=[]] - Array of component declarations matching tag numbers
 * @returns {Array<React.ReactNode>} Array of React nodes (elements and text)
 *
 * @example
 * ```jsx
 * const result = renderTranslation(
 *   "<0>bonjour</0> monde",
 *   [{ type: 'strong', props: { className: 'bold' } }]
 * );
 * // Returns: [<strong className="bold">bonjour</strong>, " monde"]
 * ```
 *
 * @example
 * ```jsx
 * // With nested children in declaration
 * const result = renderTranslation(
 *   "<0>Click <1>here</1></0>",
 *   [
 *     {
 *       type: 'div',
 *       props: {
 *         children: [{ type: 'span', props: {} }]
 *       }
 *     }
 *   ]
 * );
 * ```
 */
export const renderTranslation = (translation, declarations = []) => {
  if (!translation) {
    return [];
  }

  const tokens = tokenize(translation);
  const result = [];
  const stack = [];

  // Track tag numbers that should be treated as literal text (no declaration found)
  const literalTagNumbers = new Set();

  // Helper to get the current declarations array based on context
  const getCurrentDeclarations = () => {
    if (stack.length === 0) {
      return declarations;
    }

    const parentFrame = stack[stack.length - 1];

    // If the parent declaration has children declarations, use those
    if (
      parentFrame.declaration.props?.children &&
      Array.isArray(parentFrame.declaration.props.children)
    ) {
      return parentFrame.declaration.props.children;
    }

    // Otherwise, use the parent's declarations array
    return parentFrame.declarations;
  };

  tokens.forEach((token) => {
    // eslint-disable-next-line default-case
    switch (token.type) {
      case 'Text':
        {
          const decoded = decodeHtmlEntities(token.value);
          const targetArray = stack.length > 0 ? stack[stack.length - 1].children : result;

          targetArray.push(decoded);
        }

        break;

      case 'TagOpen':
        {
          const { tagNumber } = token;
          const currentDeclarations = getCurrentDeclarations();
          const declaration = currentDeclarations[tagNumber];

          if (!declaration) {
            // No declaration found - treat this tag as literal text
            literalTagNumbers.add(tagNumber);

            const literalText = `<${tagNumber}>`;
            const targetArray = stack.length > 0 ? stack[stack.length - 1].children : result;

            targetArray.push(literalText);

            break;
          }

          stack.push({
            tagNumber,
            children: [],
            position: token.position,
            declaration,
            declarations: currentDeclarations,
          });
        }

        break;

      case 'TagClose':
        {
          const { tagNumber } = token;

          // If this tag was treated as literal, output the closing tag as literal text
          if (literalTagNumbers.has(tagNumber)) {
            const literalText = `</${tagNumber}>`;
            const literalTargetArray = stack.length > 0 ? stack[stack.length - 1].children : result;

            literalTargetArray.push(literalText);

            literalTagNumbers.delete(tagNumber);

            break;
          }

          if (stack.length === 0) {
            throw new TranslationParserError(
              `Unexpected closing tag </${tagNumber}> at position ${token.position}`,
              token.position,
              translation,
            );
          }

          const frame = stack.pop();

          if (frame.tagNumber !== tagNumber) {
            throw new TranslationParserError(
              `Mismatched tags: expected </${frame.tagNumber}> but got </${tagNumber}> at position ${token.position}`,
              token.position,
              translation,
            );
          }

          // Render the element using the declaration and collected children
          const element = renderDeclarationNode(
            frame.declaration,
            frame.children,
            frame.declarations,
          );

          const elementTargetArray = stack.length > 0 ? stack[stack.length - 1].children : result;

          elementTargetArray.push(element);
        }

        break;
    }
  });

  if (stack.length > 0) {
    const unclosed = stack[stack.length - 1];

    throw new TranslationParserError(
      `Unclosed tag <${unclosed.tagNumber}> at position ${unclosed.position}`,
      unclosed.position,
      translation,
    );
  }

  return result;
};
