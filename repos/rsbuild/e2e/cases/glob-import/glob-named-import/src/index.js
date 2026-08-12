const labels = import.meta.glob('./modules/*.js', {
  import: 'label',
});

const labelPromises = Object.keys(labels)
  .sort()
  .map((labelPath) => labels[labelPath]());

Promise.all(labelPromises).then((values) => {
  const result = values.join(',');
  document.body.innerHTML = `<div id="named-import-result">${result}</div>`;
});
