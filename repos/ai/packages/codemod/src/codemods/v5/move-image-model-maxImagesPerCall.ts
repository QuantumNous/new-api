import { createTransformer } from '../lib/create-transformer';

/**
 * Transforms image model settings from model construction to generateImage options
 *
 * Before:
 * await generateImage({
 *   model: provider.image('model-id', {
 *     maxImagesPerCall: 5,
 *     pollIntervalMillis: 500,
 *   }),
 *   prompt,
 *   n: 10,
 * });
 *
 * After:
 * await generateImage({
 *   model: provider.image('model-id'),
 *   prompt,
 *   n: 10,
 *   maxImagesPerCall: 5,
 *   providerOptions: {
 *     provider: { pollIntervalMillis: 500 },
 *   },
 * });
 */
export default createTransformer((fileInfo, api, options, context) => {
  const { j, root } = context;

  // Find generateImage call expressions
  root
    .find(j.CallExpression, {
      callee: {
        type: 'Identifier',
        name: 'generateImage',
      },
    })
    .forEach(path => {
      const args = path.node.arguments;
      if (args.length !== 1 || args[0].type !== 'ObjectExpression') {
        return;
      }

      const configObject = args[0];
      let modelProperty: any = null;
      let maxImagesPerCallFromModel: any = null;
      let providerSettingsFromModel: Record<string, any> = {};
      let providerName: string | null = null;

      // Find the model property
      configObject.properties.forEach((prop: any) => {
        if (
          (prop.type === 'Property' || prop.type === 'ObjectProperty') &&
          ((prop.key.type === 'Identifier' && prop.key.name === 'model') ||
            (prop.key.type === 'Literal' && prop.key.value === 'model'))
        ) {
          modelProperty = prop;
        }
      });

      if (!modelProperty) {
        return;
      }

      // Check if the model property value is a call expression (provider.image(...))
      if (
        modelProperty.value.type === 'CallExpression' &&
        modelProperty.value.callee.type === 'MemberExpression' &&
        modelProperty.value.callee.property.type === 'Identifier' &&
        modelProperty.value.callee.property.name === 'image'
      ) {
        const imageCall = modelProperty.value;

        // Extract provider name from the callee
        if (imageCall.callee.object.type === 'Identifier') {
          providerName = imageCall.callee.object.name;
        }

        // Check if there's a second argument with settings
        if (
          imageCall.arguments.length === 2 &&
          imageCall.arguments[1].type === 'ObjectExpression'
        ) {
          const settingsObject = imageCall.arguments[1];

          // Extract settings from the model constructor
          settingsObject.properties.forEach((settingProp: any) => {
            if (
              settingProp.type === 'Property' ||
              settingProp.type === 'ObjectProperty'
            ) {
              const keyName =
                settingProp.key.type === 'Identifier'
                  ? settingProp.key.name
                  : settingProp.key.value;

              if (keyName === 'maxImagesPerCall') {
                maxImagesPerCallFromModel = settingProp.value;
              } else {
                providerSettingsFromModel[keyName] = settingProp.value;
              }
            }
          });

          // Remove the settings argument from the image call
          imageCall.arguments = [imageCall.arguments[0]];
          context.hasChanges = true;
        }
      }

      // Add maxImagesPerCall to the generateImage config if it was in the model
      if (maxImagesPerCallFromModel) {
        const maxImagesPerCallProp = j.property(
          'init',
          j.identifier('maxImagesPerCall'),
          maxImagesPerCallFromModel,
        );
        configObject.properties.push(maxImagesPerCallProp);
      }

      // Add or update providerOptions with the extracted settings
      if (Object.keys(providerSettingsFromModel).length > 0 && providerName) {
        let providerOptionsProperty: any = null;

        // Find existing providerOptions property
        configObject.properties.forEach((prop: any) => {
          if (
            (prop.type === 'Property' || prop.type === 'ObjectProperty') &&
            ((prop.key.type === 'Identifier' &&
              prop.key.name === 'providerOptions') ||
              (prop.key.type === 'Literal' &&
                prop.key.value === 'providerOptions'))
          ) {
            providerOptionsProperty = prop;
          }
        });

        if (!providerOptionsProperty) {
          // Create new providerOptions property
          const providerSettingsProperties = Object.entries(
            providerSettingsFromModel,
          ).map(([key, value]) => j.property('init', j.identifier(key), value));

          const providerOptionsValue = j.objectExpression([
            j.property(
              'init',
              j.identifier(providerName),
              j.objectExpression(providerSettingsProperties),
            ),
          ]);

          providerOptionsProperty = j.property(
            'init',
            j.identifier('providerOptions'),
            providerOptionsValue,
          );
          configObject.properties.push(providerOptionsProperty);
        } else {
          // Update existing providerOptions
          if (providerOptionsProperty.value.type === 'ObjectExpression') {
            let providerProperty: any = null;

            // Find the provider property in providerOptions
            providerOptionsProperty.value.properties.forEach((prop: any) => {
              if (
                (prop.type === 'Property' || prop.type === 'ObjectProperty') &&
                ((prop.key.type === 'Identifier' &&
                  prop.key.name === providerName) ||
                  (prop.key.type === 'Literal' &&
                    prop.key.value === providerName))
              ) {
                providerProperty = prop;
              }
            });

            if (!providerProperty) {
              // Create new provider property
              const providerSettingsProperties = Object.entries(
                providerSettingsFromModel,
              ).map(([key, value]) =>
                j.property('init', j.identifier(key), value),
              );

              providerProperty = j.property(
                'init',
                j.identifier(providerName),
                j.objectExpression(providerSettingsProperties),
              );
              providerOptionsProperty.value.properties.push(providerProperty);
            } else {
              // Merge with existing provider property
              if (providerProperty.value.type === 'ObjectExpression') {
                const newSettingsProperties = Object.entries(
                  providerSettingsFromModel,
                ).map(([key, value]) =>
                  j.property('init', j.identifier(key), value),
                );
                providerProperty.value.properties.push(
                  ...newSettingsProperties,
                );
              }
            }
          }
        }
      }
    });
});
