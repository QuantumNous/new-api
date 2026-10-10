import normalSvg from '@e2e/assets/circle.svg?not-raw';
import rawSvg from '@e2e/assets/circle.svg?raw';
import rawTs4 from './bar.ts?other=value&raw';
import rawTs1 from './bar.ts?raw';
import rawTs2 from './bar.ts?raw=1';
import rawTs3 from './bar.ts?raw&other=value';
import rawTsx from './baz.tsx?raw';
import normalJs from './foo.js?not-raw';
import rawJs from './foo.js?raw';

window.rawSvg = rawSvg;
window.normalSvg = normalSvg;
window.rawJs = rawJs;
window.rawTs1 = rawTs1;
window.rawTs2 = rawTs2;
window.rawTs3 = rawTs3;
window.rawTs4 = rawTs4;
window.rawTsx = rawTsx;
window.normalJs = normalJs;
