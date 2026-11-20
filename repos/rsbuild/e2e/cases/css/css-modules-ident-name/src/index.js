import style1 from './a.module.css';
import style2 from './sub/a.module.css';

document.getElementById('root').innerHTML = `
  <div>
    <div id="test1" class="${style1.foo}">Test1</div>
    <div id="test2" class="${style2.foo}">Test1</div>
  </div>
`;
