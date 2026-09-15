import { content } from '@/common/test';

const testAliasEl = document.createElement('div');
testAliasEl.id = 'foo';
testAliasEl.innerHTML = content;
document.body.appendChild(testAliasEl);

const testEl = document.createElement('div');
testEl.id = 'test';
testEl.innerHTML = 'Hello Rsbuild!';

document.body.appendChild(testEl);
