import { createTransformer } from '../lib/create-transformer';

const REMOVED_METHODS = [
  'toAIStream',
  'pipeAIStreamToResponse',
  'toAIStreamResponse',
];

export default createTransformer((fileInfo, api, options, context) => {
  const { j, root } = context;

  // Find calls to removed methods
  root.find(j.MemberExpression).forEach(path => {
    if (
      path.node.property.type === 'Identifier' &&
      REMOVED_METHODS.includes(path.node.property.name)
    ) {
      context.hasChanges = true;

      // Find the parent statement to add the comment
      const statement = path.parent.parent;
      if (statement && statement.node) {
        // Add block comment above the statement
        const comment = j.commentBlock(
          ` WARNING: ${path.node.property.name} has been removed from streamText.\n` +
            ` See migration guide at https://ai-sdk.dev/docs/migration-guides `,
          true, // leading
          false, // trailing
        );

        statement.node.comments = statement.node.comments || [];
        statement.node.comments.unshift(comment);
      }
    }
  });

  if (context.hasChanges) {
    context.messages.push(
      `Found usage of removed streamText methods: ${REMOVED_METHODS.join(
        ', ',
      )}. These methods have been removed. Please see migration guide.`,
    );
  }
});
