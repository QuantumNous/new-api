import { isString } from './utils.js';

const capitalize = (string) => string.charAt(0).toUpperCase() + string.slice(1);

export function formatLanguageCode(code) {
  // http://www.iana.org/assignments/language-tags/language-tags.xhtml
  if (isString(code) && code.indexOf('-') > -1) {
    if (typeof Intl !== 'undefined' && typeof Intl.getCanonicalLocales !== 'undefined') {
      try {
        let formattedCode = Intl.getCanonicalLocales(code)[0];
        if (formattedCode && this.options.lowerCaseLng) {
          formattedCode = formattedCode.toLowerCase();
        }
        if (formattedCode) return formattedCode;
      } catch (e) {
        /* fall through */
      }
    }
    // fallback for non-Intl environments
    const specialCases = ['hans', 'hant', 'latn', 'cyrl', 'cans', 'mong', 'arab'];
    let p = code.split('-');

    if (this.options.lowerCaseLng) {
      p = p.map((part) => part.toLowerCase());
    } else if (p.length === 2) {
      p[0] = p[0].toLowerCase();
      p[1] = p[1].toUpperCase();

      if (specialCases.indexOf(p[1].toLowerCase()) > -1) p[1] = capitalize(p[1].toLowerCase());
    } else if (p.length === 3) {
      p[0] = p[0].toLowerCase();

      // if length 2 guess it's a country
      if (p[1].length === 2) p[1] = p[1].toUpperCase();
      if (p[0] !== 'sgn' && p[2].length === 2) p[2] = p[2].toUpperCase();

      if (specialCases.indexOf(p[1].toLowerCase()) > -1) p[1] = capitalize(p[1].toLowerCase());
      if (specialCases.indexOf(p[2].toLowerCase()) > -1) p[2] = capitalize(p[2].toLowerCase());
    }

    return p.join('-');
  }

  return this.options.cleanCode || this.options.lowerCaseLng ? code.toLowerCase() : code;
}
