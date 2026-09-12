import { sayHello } from './sayHello';

const result = await sayHello();

declare global {
  interface Window {
    foo: string;
  }
}

window.foo = result;
