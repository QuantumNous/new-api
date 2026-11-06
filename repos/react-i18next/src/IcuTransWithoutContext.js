import React from 'react';
import { warn, warnOnce, isString } from './utils.js';
import { getI18n } from './i18nInstance.js';
import { renderTranslation } from './IcuTransUtils/index.js';

/**
 * IcuTrans component for rendering ICU MessageFormat translations (without React Context)
 *
 * This is the core implementation without React hooks or context dependencies,
 * making it suitable for use in any environment. It uses a declaration tree
 * approach where components are defined as type + props blueprints, fetches
 * the translated string via i18next, and reconstructs the React element tree
 * by replacing numbered tags (<0>, <1>) with actual components.
 *
 * Key features:
 * - No React hooks or context (can be used anywhere)
 * - ICU MessageFormat compatible
 * - Supports nested component declarations
 * - Automatic HTML entity decoding
 * - Graceful error handling with fallbacks
 * - Merges default interpolation variables
 *
 * Note: Users should typically use the IcuTrans export which provides automatic
 * context support. This component is exposed for advanced use cases where direct
 * i18n instance control is needed, or for use outside of React Context.
 *
 * @param {Object} props - Component props
 * @param {string} props.i18nKey - The i18n key to look up the translation
 * @param {string} props.defaultTranslation - The default translation in ICU format with numbered tags (e.g., "<0>Click here</0>")
 * @param {Array<{type: string|React.ComponentType, props?: Object}>} props.content - Declaration tree describing React components and their props
 * @param {string|string[]} [props.ns] - Optional namespace(s) for the translation. Falls back to t.ns, then i18n.options.defaultNS, then 'translation'
 * @param {Object} [props.values={}] - Optional values for ICU variable interpolation (merged with i18n.options.interpolation.defaultVariables if present)
 * @param {Object} [props.i18n] - i18next instance. If not provided, uses global instance from getI18n()
 * @param {Function} [props.t] - Custom translation function. If not provided, uses i18n.t.bind(i18n)
 * @returns {React.ReactElement} React fragment containing the rendered translation
 *
 * @example
 * ```jsx
 * // Direct usage with i18n instance
 * <IcuTransWithoutContext
 *   i18nKey="welcome.message"
 *   defaultTranslation="Welcome <0>back</0>!"
 *   content={[
 *     { type: 'strong', props: { className: 'highlight' } }
 *   ]}
 *   i18n={i18nInstance}
 * />
 * ```
 *
 * @example
 * ```jsx
 * // With nested declarations for list rendering
 * <IcuTransWithoutContext
 *   i18nKey="features.list"
 *   defaultTranslation="Features: <0><0>Fast</0><1>Reliable</1><2>Secure</2></0>"
 *   content={[
 *     {
 *       type: 'ul',
 *       props: {
 *         children: [
 *           { type: 'li', props: {} },
 *           { type: 'li', props: {} },
 *           { type: 'li', props: {} }
 *         ]
 *       }
 *     }
 *   ]}
 *   i18n={i18nInstance}
 * />
 * ```
 *
 * @example
 * ```jsx
 * // With values for ICU variable interpolation
 * <IcuTransWithoutContext
 *   i18nKey="greeting"
 *   defaultTranslation="Hello <0>{name}</0>!"
 *   content={[{ type: 'strong', props: {} }]}
 *   values={{ name: 'Alice' }}
 *   i18n={i18nInstance}
 * />
 * ```
 */
export function IcuTransWithoutContext({
  i18nKey,
  defaultTranslation,
  content,
  ns,
  values = {},
  i18n: i18nFromProps,
  t: tFromProps,
}) {
  const i18n = i18nFromProps || getI18n();

  if (!i18n) {
    warnOnce(
      i18n,
      'NO_I18NEXT_INSTANCE',
      `IcuTrans: You need to pass in an i18next instance using i18nextReactModule`,
      { i18nKey },
    );
    return React.createElement(React.Fragment, {}, defaultTranslation);
  }

  const t = tFromProps || i18n.t?.bind(i18n) || ((k) => k);

  // prepare having a namespace
  let namespaces = ns || t.ns || i18n.options?.defaultNS;
  namespaces = isString(namespaces) ? [namespaces] : namespaces || ['translation'];

  // Merge default interpolation variables if they exist
  let mergedValues = values;
  if (i18n.options?.interpolation?.defaultVariables) {
    mergedValues =
      values && Object.keys(values).length > 0
        ? { ...values, ...i18n.options.interpolation.defaultVariables }
        : { ...i18n.options.interpolation.defaultVariables };
  }

  // Get the translation, falling back to defaultTranslation
  const translation = t(i18nKey, {
    defaultValue: defaultTranslation,
    ...mergedValues,
    ns: namespaces,
  });

  // Render the translation with the declaration tree
  try {
    const rendered = renderTranslation(translation, content);

    // Return as a React fragment to avoid extra wrapper
    return React.createElement(React.Fragment, {}, ...rendered);
  } catch (error) {
    // If rendering fails, warn and fall back to the translation string
    warn(
      i18n,
      'ICU_TRANS_RENDER_ERROR',
      `IcuTrans component error for key "${i18nKey}": ${error.message}`,
      { i18nKey, error },
    );

    return React.createElement(React.Fragment, {}, translation);
  }
}

IcuTransWithoutContext.displayName = 'IcuTransWithoutContext';
