/*
 * Light SEO helpers for classic theme (merge-friendly).
 */
export function applyClassicSeo(status = {}) {
  if (typeof document === 'undefined') return;
  const title = status.system_name || document.title || 'New API';
  document.title = title;

  const setName = (name, content) => {
    if (!content) return;
    let el = document.querySelector(`meta[name="${name}"]`);
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute('name', name);
      document.head.appendChild(el);
    }
    el.setAttribute('content', content);
  };
  const setProp = (property, content) => {
    if (!content) return;
    let el = document.querySelector(`meta[property="${property}"]`);
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute('property', property);
      document.head.appendChild(el);
    }
    el.setAttribute('content', content);
  };

  const desc =
    status.seo_description ||
    document
      .querySelector('meta[name="description"]')
      ?.getAttribute('content') ||
    '';
  const keywords = status.seo_keywords || '';
  const site = (status.seo_site_url || status.server_address || '').replace(
    /\/$/,
    ''
  );
  const ogImage = status.seo_og_image || status.logo || '/logo.png';
  const robotsIndex = status.seo_robots_index !== false;

  setName('title', title);
  if (desc) setName('description', desc);
  if (keywords) setName('keywords', keywords);
  setName('robots', robotsIndex ? 'index,follow' : 'noindex,nofollow');
  setProp('og:type', 'website');
  setProp('og:title', title);
  if (desc) setProp('og:description', desc);
  if (ogImage) setProp('og:image', ogImage);
  if (site) setProp('og:url', site + (window.location.pathname || '/'));
  setName('twitter:card', 'summary');
  setName('twitter:title', title);
  if (desc) setName('twitter:description', desc);
}
