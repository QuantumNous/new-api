import { CAT, FISH } from './constants';
import * as namespace from './namespace';

declare global {
  interface Window {
    testFish: string;
    testCat: string;
    testDog: string;
    testNamespace: string;
  }
}

window.testFish = `${FISH},${FISH.toUpperCase()}`;
window.testCat = `${CAT},${CAT.toUpperCase()}`;
window.testNamespace = `${namespace.Foo.A},${namespace.Foo.B}`;

import('./dynamic').then(({ DOG }) => {
  window.testDog = `${DOG},${DOG.toUpperCase()}`;
});
