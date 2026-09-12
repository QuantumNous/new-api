const modules = import.meta.glob('./modules/*.js', {
  eager: true,
});

const values = Object.keys(modules)
  .sort()
  .map((modulePath) => modules[modulePath].default);
const result = values.join(',');

document.body.innerHTML = `<div id="eager-result">${result}</div>`;
