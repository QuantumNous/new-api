import style from './a.module.css';

document.getElementById('root').innerHTML = `
  <div>
    <div id="test1" class="${style.foo}">Test1</div>
    <div id="test2" class="${style.bar}">Test2</div>
  </div>
`;
