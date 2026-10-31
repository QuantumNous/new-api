import type { API, FileInfo } from 'jscodeshift';
import { createTransformer } from '../lib/create-transformer';

const AI_METHODS_WITH_MESSAGES = [
  'generateText',
  'streamText',
  'generateObject',
  'streamObject',
  'generateSpeech',
  'transcribe',
  'streamUI',
  'render',
] as const;

export default createTransformer(
  (fileInfo: FileInfo, api: API, options, context) => {
    const { j, root } = context;

    // Find all call expressions to AI methods that accept messages
    root
      .find(j.CallExpression)
      .filter(path => {
        const callee = path.value.callee;
        if (j.Identifier.check(callee)) {
          return AI_METHODS_WITH_MESSAGES.includes(callee.name as any);
        }
        return false;
      })
      .forEach(path => {
        const args = path.value.arguments;
        if (args.length === 0) return;

        const firstArg = args[0];
        if (!j.ObjectExpression.check(firstArg)) return;

        // Look for the messages property
        const messagesProperty = firstArg.properties.find(prop => {
          if (j.Property.check(prop) || j.ObjectProperty.check(prop)) {
            const key = prop.key;
            return (
              (j.Identifier.check(key) && key.name === 'messages') ||
              (j.Literal.check(key) && key.value === 'messages') ||
              (j.StringLiteral.check(key) && key.value === 'messages')
            );
          }
          return false;
        });

        if (!messagesProperty) return;

        const messagesProp = messagesProperty as any;
        if (!j.ArrayExpression.check(messagesProp.value)) return;

        // Iterate through messages array
        messagesProp.value.elements.forEach((messageElement: any) => {
          if (!j.ObjectExpression.check(messageElement)) return;

          // Look for content property in message
          const contentPropertyIndex = messageElement.properties.findIndex(
            (prop: any) => {
              if (j.Property.check(prop) || j.ObjectProperty.check(prop)) {
                const key = prop.key;
                return (
                  (j.Identifier.check(key) && key.name === 'content') ||
                  (j.Literal.check(key) && key.value === 'content') ||
                  (j.StringLiteral.check(key) && key.value === 'content')
                );
              }
              return false;
            },
          );

          if (contentPropertyIndex === -1) return;

          const contentProperty = messageElement.properties[
            contentPropertyIndex
          ] as any;

          // Check if there's already a parts property
          const hasPartsProperty = messageElement.properties.some(
            (prop: any) => {
              if (j.Property.check(prop) || j.ObjectProperty.check(prop)) {
                const key = prop.key;
                return (
                  (j.Identifier.check(key) && key.name === 'parts') ||
                  (j.Literal.check(key) && key.value === 'parts') ||
                  (j.StringLiteral.check(key) && key.value === 'parts')
                );
              }
              return false;
            },
          );

          // Don't transform if parts already exists
          if (hasPartsProperty) return;

          const contentValue = contentProperty.value;

          // Create parts array based on content type
          let partsArray;

          if (
            j.StringLiteral.check(contentValue) ||
            j.Literal.check(contentValue)
          ) {
            // String content -> parts: [{ type: 'text', text: content }]
            partsArray = j.arrayExpression([
              j.objectExpression([
                j.property('init', j.identifier('type'), j.literal('text')),
                j.property('init', j.identifier('text'), contentValue),
              ]),
            ]);
          } else if (j.TemplateLiteral.check(contentValue)) {
            // Template literal -> parts: [{ type: 'text', text: contentValue }]
            partsArray = j.arrayExpression([
              j.objectExpression([
                j.property('init', j.identifier('type'), j.literal('text')),
                j.property('init', j.identifier('text'), contentValue),
              ]),
            ]);
          } else if (j.ArrayExpression.check(contentValue)) {
            // If content is already an array, assume it's parts-like and use as-is
            partsArray = contentValue;
          } else {
            // For other expressions (variables, function calls, etc.)
            // Transform to parts: [{ type: 'text', text: content }]
            partsArray = j.arrayExpression([
              j.objectExpression([
                j.property('init', j.identifier('type'), j.literal('text')),
                j.property('init', j.identifier('text'), contentValue),
              ]),
            ]);
          }

          // Replace content property with parts property
          const partsProperty = j.property(
            'init',
            j.identifier('parts'),
            partsArray,
          );
          messageElement.properties[contentPropertyIndex] = partsProperty;

          context.hasChanges = true;
        });
      });
  },
);
