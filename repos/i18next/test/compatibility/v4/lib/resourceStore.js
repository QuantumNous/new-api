export function getResourceBundle(lng, ns) {
  if (!ns) ns = this.options.defaultNS;

  // COMPATIBILITY: remove extend in v2.1.0
  if (this.options.compatibilityAPI === 'v1') return { ...{}, ...this.getResource(lng, ns) };

  return this.getResource(lng, ns);
}
