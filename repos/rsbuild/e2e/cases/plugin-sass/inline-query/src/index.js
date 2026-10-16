import aInline from './a.scss?inline';
import bInline from './b.module.scss?inline';
import bStyles from './b.module.scss?not-inline';

window.aInline = aInline;
window.bInline = bInline;
window.bStyles = bStyles;
