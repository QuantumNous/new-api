const modules = import.meta.glob('./modules/*.js');

const modulePromises = Object.keys(modules)
  .sort()
  .map(async (modulePath) => {
    const module = await modules[modulePath]();
    return module.default;
  });

Promise.all(modulePromises).then((values) => {
  const result = values.join(',');
  document.body.innerHTML = `<div id="lazy-result">${result}</div>`;
});
