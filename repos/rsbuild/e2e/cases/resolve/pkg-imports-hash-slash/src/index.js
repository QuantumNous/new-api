import { foo } from '#/foo';

const fooEl = document.createElement('div');
fooEl.id = 'foo';
fooEl.innerHTML = foo;
document.body.appendChild(fooEl);
