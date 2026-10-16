import { createTransformer } from '../lib/create-transformer';

export default createTransformer((fileInfo, api, options, context) => {
  const { j, root } = context;

  // Find member expressions that match: delta.file.mediaType or delta.file.data
  root
    .find(j.MemberExpression)
    .filter(path => {
      const node = path.node;

      // Check if this is a nested member expression: something.file.property
      if (!j.MemberExpression.check(node.object)) {
        return false;
      }

      const outerObject = node.object;

      // Check if the middle property is 'file'
      if (
        !j.Identifier.check(outerObject.property) ||
        outerObject.property.name !== 'file'
      ) {
        return false;
      }

      // Check if the outermost object is 'delta'
      if (
        !j.Identifier.check(outerObject.object) ||
        outerObject.object.name !== 'delta'
      ) {
        return false;
      }

      // Check if the final property is 'mediaType' or 'data'
      if (!j.Identifier.check(node.property)) {
        return false;
      }

      const propertyName = node.property.name;
      return propertyName === 'mediaType' || propertyName === 'data';
    })
    .forEach(path => {
      const node = path.node;
      const outerObject = node.object as any; // We know this is a MemberExpression from the filter
      const propertyName = (node.property as any).name; // We know this is an Identifier

      // Transform delta.file.mediaType to delta.mediaType
      // Transform delta.file.data to delta.data
      const newMemberExpression = j.memberExpression(
        outerObject.object, // delta
        j.identifier(propertyName), // mediaType or data
      );

      path.replace(newMemberExpression);
      context.hasChanges = true;
    });
});
