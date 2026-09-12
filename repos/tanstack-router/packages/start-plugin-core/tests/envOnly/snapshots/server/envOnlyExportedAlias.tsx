export const fn = () => 'server-only-value';
export const wrappedFn = (() => 'wrapped-server-only-value') as () => string;