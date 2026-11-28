import aRaw4 from './a.css?other=value&raw';
import aRaw1 from './a.css?raw';
import aRaw2 from './a.css?raw=1';
import aRaw3 from './a.css?raw&other=value';
import bStyles from './b.module.css?not-raw';
import bRaw from './b.module.css?raw';

window.aRaw1 = aRaw1;
window.aRaw2 = aRaw2;
window.aRaw3 = aRaw3;
window.aRaw4 = aRaw4;
window.bRaw = bRaw;
window.bStyles = bStyles;
