const testEl = document.createElement('div');
testEl.id = 'test';
testEl.innerHTML = process.env.ASSET_PREFIX;
document.body.appendChild(testEl);

const testEl2 = document.createElement('div');
testEl2.id = 'test2';
testEl2.innerHTML = import.meta.env.ASSET_PREFIX;
document.body.appendChild(testEl2);
