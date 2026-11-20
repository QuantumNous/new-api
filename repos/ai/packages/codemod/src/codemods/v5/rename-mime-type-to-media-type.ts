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
          const contentProperty = messageElement.properties.find(
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

          if (!contentProperty) return;

          const contentProp = contentProperty as any;
          if (!j.ArrayExpression.check(contentProp.value)) return;

          // Iterate through content array
          contentProp.value.elements.forEach((contentElement: any) => {
            if (!j.ObjectExpression.check(contentElement)) return;

            // Check if this is a file content object (has type: 'file')
            const typeProperty = contentElement.properties.find((prop: any) => {
              if (j.Property.check(prop) || j.ObjectProperty.check(prop)) {
                const key = prop.key;
                const keyName = j.Identifier.check(key)
                  ? key.name
                  : j.Literal.check(key)
                    ? key.value
                    : j.StringLiteral.check(key)
                      ? key.value
                      : null;

                if (keyName === 'type') {
                  const value = prop.value;
                  return (
                    (j.Literal.check(value) && value.value === 'file') ||
                    (j.StringLiteral.check(value) && value.value === 'file') ||
                    (j.Identifier.check(value) && value.name === 'file')
                  );
                }
              }
              return false;
            });

            if (!typeProperty) return;

            // Look for mimeType property and rename it to mediaType
            const mimeTypeProperty = contentElement.properties.find(
              (prop: any) => {
                if (j.Property.check(prop) || j.ObjectProperty.check(prop)) {
                  const key = prop.key;
                  return (
                    (j.Identifier.check(key) && key.name === 'mimeType') ||
                    (j.Literal.check(key) && key.value === 'mimeType') ||
                    (j.StringLiteral.check(key) && key.value === 'mimeType')
                  );
                }
                return false;
              },
            );

            if (mimeTypeProperty) {
              const mimeTypeProp = mimeTypeProperty as any;

              // Rename the key
              if (j.Identifier.check(mimeTypeProp.key)) {
                mimeTypeProp.key.name = 'mediaType';
              } else if (j.Literal.check(mimeTypeProp.key)) {
                mimeTypeProp.key.value = 'mediaType';
              } else if (j.StringLiteral.check(mimeTypeProp.key)) {
                mimeTypeProp.key.value = 'mediaType';
              }

              context.hasChanges = true;
            }
          });
        });
      });
  },
);
