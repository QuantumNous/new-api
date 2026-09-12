import type { MemberExpression } from 'jscodeshift';
import { createTransformer } from '../lib/create-transformer';

const ERROR_METHOD_MAPPINGS: Record<string, string> = {
  isAPICallError: 'APICallError.isInstance',
  isEmptyResponseBodyError: 'EmptyResponseBodyError.isInstance',
  isInvalidArgumentError: 'InvalidArgumentError.isInstance',
  isInvalidPromptError: 'InvalidPromptError.isInstance',
  isInvalidResponseDataError: 'InvalidResponseDataError.isInstance',
  isJSONParseError: 'JSONParseError.isInstance',
  isLoadAPIKeyError: 'LoadAPIKeyError.isInstance',
  isLoadSettingError: 'LoadSettingError.isInstance',
  isNoContentGeneratedError: 'NoContentGeneratedError.isInstance',
  isNoObjectGeneratedError: 'NoObjectGeneratedError.isInstance',
  isNoSuchModelError: 'NoSuchModelError.isInstance',
  isNoSuchProviderError: 'NoSuchProviderError.isInstance',
  isNoSuchToolError: 'NoSuchToolError.isInstance',
  isTooManyEmbeddingValuesForCallError:
    'TooManyEmbeddingValuesForCallError.isInstance',
  isTypeValidationError: 'TypeValidationError.isInstance',
  isUnsupportedFunctionalityError: 'UnsupportedFunctionalityError.isInstance',
  isInvalidDataContentError: 'InvalidDataContentError.isInstance',
  isInvalidMessageRoleError: 'InvalidMessageRoleError.isInstance',
  isDownloadError: 'DownloadError.isInstance',
  isRetryError: 'RetryError.isInstance',
};

export default createTransformer((fileInfo, api, options, context) => {
  const { j, root } = context;

  // Track imports from ai packages
  const targetImports = new Set<string>();

  // Collect imports from ai packages
  root
    .find(j.ImportDeclaration)
    .filter(
      path =>
        path.node.source.value === 'ai' ||
        (typeof path.node.source.value === 'string' &&
          path.node.source.value.startsWith('@ai-sdk/')),
    )
    .forEach(path => {
      path.node.specifiers?.forEach(spec => {
        if (spec.type === 'ImportSpecifier') {
          const name = spec.imported.name;
          if (Object.keys(ERROR_METHOD_MAPPINGS).includes(name)) {
            context.hasChanges = true;
            targetImports.add(spec.local?.name || name);
          }
        }
      });
    });

  // Replace method calls
  root
    .find(j.CallExpression)
    .filter(path => {
      const callee = path.node.callee;
      return (
        callee.type === 'MemberExpression' &&
        'property' in callee &&
        callee.property.type === 'Identifier' &&
        Object.keys(ERROR_METHOD_MAPPINGS).includes(callee.property.name)
      );
    })
    .forEach(path => {
      context.hasChanges = true;
      const property = (path.node.callee as MemberExpression).property;
      const methodName = property.type === 'Identifier' ? property.name : '';
      const newMethodPath = ERROR_METHOD_MAPPINGS[methodName].split('.');

      j(path).replaceWith(
        j.callExpression(
          j.memberExpression(
            j.identifier(newMethodPath[0]),
            j.identifier(newMethodPath[1]),
          ),
          path.node.arguments,
        ),
      );
    });
});
