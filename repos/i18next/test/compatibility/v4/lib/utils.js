export const isString = (obj) => typeof obj === 'string';

export const getCleanedCode = (code) => code && code.replace('_', '-');
