import { bar } from './bar.js';
import { foo } from './foo.js';

declare global {
  interface Window {
    test: number;
  }
}

window.test = foo;

console.log(bar);
