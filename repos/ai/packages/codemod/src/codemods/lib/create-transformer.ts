import type { FileInfo, API, JSCodeshift, Collection } from 'jscodeshift';

type TransformerFunction = (
  fileInfo: FileInfo,
  api: API,
  options: any,
  context: TransformContext,
) => void;

export interface TransformContext {
  /**
   * The jscodeshift API object.
   */
  j: JSCodeshift;

  /**
   * The root collection of the AST.
   */
  root: Collection<any>;

  /**
   * Codemods should set this to true if they make any changes to the AST.
   */
  hasChanges: boolean;

  /**
   * Codemods can append messages to this array to report information to the user.
   */
  messages: string[];
}

export function createTransformer(transformFn: TransformerFunction) {
  // Note the return type of this function is explicitly designed to conform to
  // the signature expected by jscodeshift. For more see
  // https://github.com/facebook/jscodeshift
  return function transformer(fileInfo: FileInfo, api: API, options: any) {
    const j = api.jscodeshift;
    const root = j(fileInfo.source);
    const context: TransformContext = {
      j,
      root,
      hasChanges: false,
      messages: [],
    };

    // Execute the transformation
    transformFn(fileInfo, api, options, context);

    // Report any messages
    context.messages.forEach(message => api.report(message));

    // Return the transformed source code if changes were made
    return context.hasChanges ? root.toSource({ quote: 'single' }) : null;
  };
}
