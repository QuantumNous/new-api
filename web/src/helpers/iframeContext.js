export function postIframeContext(iframe, context = {}) {
  const iframeWindow = iframe?.contentWindow;
  if (!iframeWindow || typeof iframeWindow.postMessage !== 'function') {
    return false;
  }

  let posted = false;

  if (Object.prototype.hasOwnProperty.call(context, 'themeMode')) {
    iframeWindow.postMessage({ themeMode: context.themeMode ?? '' }, '*');
    posted = true;
  }

  if (Object.prototype.hasOwnProperty.call(context, 'lang')) {
    iframeWindow.postMessage({ lang: context.lang ?? '' }, '*');
    posted = true;
  }

  return posted;
}

export function postThemeModeToIframe(iframe, themeMode) {
  return postIframeContext(iframe, { themeMode });
}

export function postLanguageToIframe(iframe, lang) {
  return postIframeContext(iframe, { lang });
}
