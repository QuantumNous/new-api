/**
 * Repo-local oxlint plugin for AI SDK conventions.
 *
 * `ai-sdk/require-validate-url`: every `getFromApi` call must pass an inline
 * options object with an explicit `validateUrl` property. The option is
 * optional in the public type (a required property would break external
 * callers of `@ai-sdk/provider-utils`), so this rule restores the forcing
 * function for in-repo code: omitting the flag skips URL validation, and that
 * decision must be visible at the call site.
 * See contributing/secure-url-handling.md.
 */

const requireValidateUrl = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Require an explicit `validateUrl` property on every `getFromApi` call.',
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        if (
          node.callee.type !== 'Identifier' ||
          node.callee.name !== 'getFromApi'
        ) {
          return;
        }

        const [options] = node.arguments;

        // Fail closed: an options value built elsewhere cannot be verified
        // statically, so require an inline object literal.
        if (options === undefined || options.type !== 'ObjectExpression') {
          context.report({
            node,
            message:
              'Pass `getFromApi` an inline options object with an explicit `validateUrl` (see contributing/secure-url-handling.md).',
          });
          return;
        }

        const hasValidateUrl = options.properties.some(
          property =>
            property.type === 'Property' &&
            !property.computed &&
            ((property.key.type === 'Identifier' &&
              property.key.name === 'validateUrl') ||
              (property.key.type === 'Literal' &&
                property.key.value === 'validateUrl')),
        );

        if (!hasValidateUrl) {
          context.report({
            node,
            message:
              'Set `validateUrl` explicitly on this `getFromApi` call: `true` when the URL comes from a provider response body, `false` for config-derived URLs (see contributing/secure-url-handling.md).',
          });
        }
      },
    };
  },
};

export default {
  meta: {
    name: 'ai-sdk',
  },
  rules: {
    'require-validate-url': requireValidateUrl,
  },
};
