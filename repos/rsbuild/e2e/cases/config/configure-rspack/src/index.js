if (ENABLE_TEST === true) {
  const test = document.createElement('div');
  test.id = 'test-el';
  test.innerHTML = 'aaaaa';
  document.body.appendChild(test);
}

const testEl = document.createElement('div');
testEl.id = 'test';
testEl.innerHTML = 'Hello Rsbuild!';

document.body.appendChild(testEl);
