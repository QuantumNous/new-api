/// <reference types="@rsbuild/core/types" />

const titleEl = document.createElement('div');
titleEl.id = 'title';
titleEl.innerText = 'web1';

const countEl = document.createElement('div');
countEl.id = 'count';
countEl.innerText = '0';

document.body.append(titleEl, countEl);

if (import.meta.webpackHot) {
  import.meta.webpackHot.on('count', () => {
    countEl.innerText = String(Number(countEl.innerText) + 1);
  });

  import.meta.webpackHot.accept();
}
