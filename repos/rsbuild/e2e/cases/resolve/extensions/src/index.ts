import { foo } from './foo';

declare global {
  interface Window {
    test: string;
  }
}

window.test = foo;
