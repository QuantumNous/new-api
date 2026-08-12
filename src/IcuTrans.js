import { useContext } from 'react';
import { IcuTransWithoutContext } from './IcuTransWithoutContext.js';
import { getI18n, I18nContext } from './context.js';

/**
 * IcuTrans component for rendering ICU MessageFormat translations with React components
 *
 * This component provides a context-aware wrapper around IcuTransWithoutContext,
 * automatically retrieving the i18n instance from React context when used within
 * an I18nextProvider. It uses a declaration tree approach where components are
 * defined as type + props blueprints, fetches the translated string, and reconstructs
 * the React element tree by replacing numbered tags with actual components.
 *
 * Key features:
 * - Supports React Context (I18nextProvider)
 * - Falls back to global i18n instance
 * - ICU MessageFormat compatible
 * - Type-safe component declarations
 * - Automatic HTML entity decoding
 *
 * @param {Object} props - Component props
 * @param {string} props.i18nKey - The i18n key to look up the translation
 * @param {string} props.defaultTranslation - The default translation in ICU format with numbered tags (e.g., "<0>Click here</0>")
 * @param {Array<{type: string|React.ComponentType, props?: Object}>} props.content - Declaration tree describing React components and their props
 * @param {string|string[]} [props.ns] - Optional namespace(s) for the translation
 * @param {Object} [props.values] - Optional values for ICU variable interpolation
 * @param {Object} [props.i18n] - Optional i18next instance (overrides context)
 * @param {Function} [props.t] - Optional translation function (overrides context)
 * @returns {React.ReactElement} React fragment containing the rendered translation
 *
 * @example
 * ```jsx
 * // Basic usage with context
 * <I18nextProvider i18n={i18n}>
 *   <IcuTrans
 *     i18nKey="welcome.message"
 *     defaultTranslation="Welcome <0>friend</0>!"
 *     content={[
 *       { type: 'strong', props: { className: 'highlight' } }
 *     ]}
 *   />
 * </I18nextProvider>
 * ```
 *
 * @example
 * ```jsx
 * // With custom components and nested structure
 * <IcuTrans
 *   i18nKey="docs.link"
 *   defaultTranslation="Read the <0>documentation <1></1></0> for more info"
 *   content={[
 *     { type: 'a', props: { href: '/docs' } },
 *     { type: Icon, props: { name: 'external' } }
 *   ]}
 * />
 * ```
 *
 * @example
 * ```jsx
 * // With nested children in declarations
 * <IcuTrans
 *   i18nKey="list.items"
 *   defaultTranslation="<0><0>First item</0><1>Second item</1></0>"
 *   content={[
 *     {
 *       type: 'ul',
 *       props: {
 *         children: [
 *           { type: 'li', props: {} },
 *           { type: 'li', props: {} }
 *         ]
 *       }
 *     }
 *   ]}
 * />
 * ```
 */
export function IcuTrans({
  i18nKey,
  defaultTranslation,
  content,
  ns,
  values = {},
  i18n: i18nFromProps,
  t: tFromProps,
}) {
  const { i18n: i18nFromContext, defaultNS: defaultNSFromContext } = useContext(I18nContext) || {};
  const i18n = i18nFromProps || i18nFromContext || getI18n();

  const t = tFromProps || i18n?.t.bind(i18n);

  return IcuTransWithoutContext({
    i18nKey,
    defaultTranslation,
    content,
    ns: ns || t?.ns || defaultNSFromContext || i18n?.options?.defaultNS,
    values,
    i18n,
    t: tFromProps,
  });
}

IcuTrans.displayName = 'IcuTrans';
