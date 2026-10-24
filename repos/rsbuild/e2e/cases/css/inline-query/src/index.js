import aInline1 from './a.css?inline';
import aInline2 from './a.css?inline=1';
import aInline3 from './a.css?inline&other=value';
import aInline4 from './a.css?other=value&inline';
import bInline from './b.module.css?inline';
import bStyles from './b.module.css?not-inline';

window.aInline1 = aInline1;
window.aInline2 = aInline2;
window.aInline3 = aInline3;
window.aInline4 = aInline4;
window.bInline = bInline;
window.bStyles = bStyles;
