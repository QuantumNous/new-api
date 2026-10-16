import { createTransformer } from '../lib/create-transformer';

export default createTransformer((fileInfo, api, options, context) => {
  const { j, root } = context;

  // Find object expressions that have a property 'type' with value 'image'
  root
    .find(j.ObjectExpression)
    .filter(path => {
      const node = path.node;

      // Check if this object has a 'type' property with value 'image'
      const typeProperty = node.properties.find(prop => {
        if (
          j.Property.check(prop) &&
          j.Identifier.check(prop.key) &&
          prop.key.name === 'type' &&
          j.Literal.check(prop.value) &&
          prop.value.value === 'image'
        ) {
          return true;
        }
        return false;
      });

      if (!typeProperty) {
        return false;
      }

      // Additional check: ensure this object also has an 'image' property
      // to distinguish from other objects that might have type: 'image'
      const hasImageProperty = node.properties.some(prop => {
        return (
          j.Property.check(prop) &&
          j.Identifier.check(prop.key) &&
          prop.key.name === 'image'
        );
      });

      return hasImageProperty;
    })
    .forEach(path => {
      const node = path.node;

      // Find and update the 'type' property
      node.properties.forEach(prop => {
        if (
          j.Property.check(prop) &&
          j.Identifier.check(prop.key) &&
          prop.key.name === 'type' &&
          j.Literal.check(prop.value) &&
          prop.value.value === 'image'
        ) {
          prop.value.value = 'file';
          context.hasChanges = true;
        }
      });
    });
});
