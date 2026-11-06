import { Animals, Numbers } from './constants';
import * as namespace from './namespace';

declare global {
  interface Window {
    testFish: string;
    testCat: string;
    testDog: string;
    testNumbers: string;
    testNamespace: string;
  }
}

window.testFish = `${Animals.Fish},${Animals.Fish.toUpperCase()}`;
window.testCat = `${Animals.Cat},${Animals.Cat.toUpperCase()}`;
window.testNumbers = `${Numbers.Zero},${Numbers.One},${Numbers.Ten},${Numbers.OnePointOne},${Numbers.One.toFixed(1)},${Numbers.MinusOne},${Numbers.MinusOnePointOne}`;
window.testNamespace = `${namespace.Foo.A},${namespace.Foo.B},${namespace.Bar.C},${namespace.Bar.D}`;

import('./dynamic').then(({ Animals2 }) => {
  window.testDog = `${Animals2.Dog},${Animals2.Dog.toUpperCase()}`;
});
