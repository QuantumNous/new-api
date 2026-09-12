import x from './initial';

const ele = document.createElement('div');
ele.innerHTML = `Hello ${x}`;
ele.setAttribute('id', 'test');
document.body.append(ele);
