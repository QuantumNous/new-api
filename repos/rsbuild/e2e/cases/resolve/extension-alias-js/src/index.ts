import { bar } from './bar.js';
import { foo } from './foo.js';

declare global {
  interface Window {
    test: string;
  }
}

window.test = foo;

console.log(bar);
