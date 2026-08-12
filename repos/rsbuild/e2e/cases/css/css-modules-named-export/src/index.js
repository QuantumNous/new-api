import { classA } from './a.module.css';
import { classB } from './b.module.scss';
import { classC } from './c.module.less';

const root = document.querySelector('#root');

if (root) {
  root.innerHTML = `${classA} ${classB} ${classC}`;
}
