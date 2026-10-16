try {
  console.log('[value] process.env.NODE_ENV', process.env.NODE_ENV);
  console.log('[value] import.meta.env.MODE', import.meta.env.MODE);
} catch {
  // do nothing
}

if (import.meta.env.MODE === 'development') {
  window['import.meta.env.MODE === "development"'] = true;
}

if (import.meta.env?.MODE === 'development') {
  window['import.meta.env?.MODE === "development"'] = true;
}

if (import.meta.env.MODE === 'production') {
  window['import.meta.env.MODE === "production"'] = true;
}

if (import.meta.env?.MODE === 'production') {
  window['import.meta.env?.MODE === "production"'] = true;
}

if (import.meta.env.DEV) {
  window['import.meta.env.DEV'] = true;
}

if (import.meta.env?.DEV) {
  window['import.meta.env?.DEV'] = true;
}

if (import.meta.env.PROD) {
  window['import.meta.env.PROD'] = true;
}

if (import.meta.env?.PROD) {
  window['import.meta.env?.PROD'] = true;
}

const { MODE, DEV, PROD } = import.meta.env;
window.destructedValues = `MODE:${MODE},DEV:${DEV},PROD:${PROD}`;
