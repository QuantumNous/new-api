window.__entryOrder = window.__entryOrder || [];
window.__entryOrder.push('second');
document.body.innerHTML = `<div id="app">${window.__entryOrder.join(',')}</div>`;
