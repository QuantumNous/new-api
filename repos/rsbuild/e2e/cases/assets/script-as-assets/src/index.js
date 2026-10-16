const test1 = new URL('./test1.js', import.meta.url).href;
const test2 = new URL('./test2.ts', import.meta.url).href;
const test3 = new URL('./test3.mjs', import.meta.url).href;

window.test1 = test1;
window.test2 = test2;
window.test3 = test3;
