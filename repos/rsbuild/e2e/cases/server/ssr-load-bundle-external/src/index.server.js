import hello from 'esm-pkg';
import undefinedDefault from 'cjs-undefined-pkg';

const helloType = typeof hello;
const undefinedType = typeof undefinedDefault;

export { helloType, undefinedType };

export const result = helloType === 'function' ? hello() : `BUG: hello is ${helloType}`;
