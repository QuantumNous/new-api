// Inline React 19 internal $$typeof symbols to avoid depending on `react-is`.
// `react-is` is CJS-only, causing module resolution failures in strict pnpm
// setups where it can't be resolved from the consumer's node_modules.
export const ReactElement = Symbol.for('react.transitional.element')
export const ReactLazy = Symbol.for('react.lazy')
export const ReactSuspense = Symbol.for('react.suspense')
