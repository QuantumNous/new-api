import { FooService } from './decorator';

console.log(FooService);

declare global {
  interface Window {
    FooService: boolean;
  }
}

window.FooService = Boolean(FooService);
