export const directSSR = import.meta.env.SSR;

const { SSR } = import.meta.env;

export const destructuredSSR = SSR;

console.log('direct SSR:', import.meta.env.SSR);
console.log('destructured SSR:', SSR);
