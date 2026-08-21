import './normal.css';
import cssText from './style.css' with { type: 'text' };
import lessText from './style.less' with { type: 'text' };
import sassText from './style.sass' with { type: 'text' };
import scssText from './style.scss' with { type: 'text' };

window.styleText = {
  css: cssText,
  less: lessText,
  sass: sassText,
  scss: scssText,
};
