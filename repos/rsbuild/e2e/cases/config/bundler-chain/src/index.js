import { test } from '@common/test';

const testEl = document.createElement('div');
testEl.id = 'test';
testEl.innerHTML = `Hello Rsbuild! ${test}`;

document.body.appendChild(testEl);

if (ENABLE_TEST === true) {
  const testDefine = document.createElement('div');
  testDefine.id = 'test-define';
  testDefine.innerHTML = 'aaaaa';
  document.body.appendChild(testDefine);
}

window.aa = 2;
