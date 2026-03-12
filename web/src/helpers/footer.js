export function normalizeFooterValue(footer) {
  return typeof footer === 'string' ? footer.trim() : '';
}

export function getFooterRenderMode(footer) {
  const normalizedFooter = normalizeFooterValue(footer);

  if (!normalizedFooter) {
    return 'default';
  }

  if (/^https?:\/\//i.test(normalizedFooter)) {
    return 'iframe';
  }

  return 'html';
}
