import { getCleanedCode } from './utils.js';

// definition http://translate.sourceforge.net/wiki/l10n/pluralforms
/* eslint-disable */
let sets = [
  {
    lngs: [
      'ach',
      'ak',
      'am',
      'arn',
      'br',
      'fil',
      'gun',
      'ln',
      'mfe',
      'mg',
      'mi',
      'oc',
      'pt',
      'pt-BR',
      'tg',
      'tl',
      'ti',
      'tr',
      'uz',
      'wa',
    ],
    nr: [1, 2],
    fc: 1,
  },

  {
    lngs: [
      'af',
      'an',
      'ast',
      'az',
      'bg',
      'bn',
      'ca',
      'da',
      'de',
      'dev',
      'el',
      'en',
      'eo',
      'es',
      'et',
      'eu',
      'fi',
      'fo',
      'fur',
      'fy',
      'gl',
      'gu',
      'ha',
      'hi',
      'hu',
      'hy',
      'ia',
      'it',
      'kk',
      'kn',
      'ku',
      'lb',
      'mai',
      'ml',
      'mn',
      'mr',
      'nah',
      'nap',
      'nb',
      'ne',
      'nl',
      'nn',
      'no',
      'nso',
      'pa',
      'pap',
      'pms',
      'ps',
      'pt-PT',
      'rm',
      'sco',
      'se',
      'si',
      'so',
      'son',
      'sq',
      'sv',
      'sw',
      'ta',
      'te',
      'tk',
      'ur',
      'yo',
    ],
    nr: [1, 2],
    fc: 2,
  },

  {
    lngs: [
      'ay',
      'bo',
      'cgg',
      'fa',
      'ht',
      'id',
      'ja',
      'jbo',
      'ka',
      'km',
      'ko',
      'ky',
      'lo',
      'ms',
      'sah',
      'su',
      'th',
      'tt',
      'ug',
      'vi',
      'wo',
      'zh',
    ],
    nr: [1],
    fc: 3,
  },

  { lngs: ['be', 'bs', 'cnr', 'dz', 'hr', 'ru', 'sr', 'uk'], nr: [1, 2, 5], fc: 4 },

  { lngs: ['ar'], nr: [0, 1, 2, 3, 11, 100], fc: 5 },
  { lngs: ['cs', 'sk'], nr: [1, 2, 5], fc: 6 },
  { lngs: ['csb', 'pl'], nr: [1, 2, 5], fc: 7 },
  { lngs: ['cy'], nr: [1, 2, 3, 8], fc: 8 },
  { lngs: ['fr'], nr: [1, 2], fc: 9 },
  { lngs: ['ga'], nr: [1, 2, 3, 7, 11], fc: 10 },
  { lngs: ['gd'], nr: [1, 2, 3, 20], fc: 11 },
  { lngs: ['is'], nr: [1, 2], fc: 12 },
  { lngs: ['jv'], nr: [0, 1], fc: 13 },
  { lngs: ['kw'], nr: [1, 2, 3, 4], fc: 14 },
  { lngs: ['lt'], nr: [1, 2, 10], fc: 15 },
  { lngs: ['lv'], nr: [1, 2, 0], fc: 16 },
  { lngs: ['mk'], nr: [1, 2], fc: 17 },
  { lngs: ['mnk'], nr: [0, 1, 2], fc: 18 },
  { lngs: ['mt'], nr: [1, 2, 11, 20], fc: 19 },
  { lngs: ['or'], nr: [2, 1], fc: 2 },
  { lngs: ['ro'], nr: [1, 2, 20], fc: 20 },
  { lngs: ['sl'], nr: [5, 1, 2, 3], fc: 21 },
  { lngs: ['he', 'iw'], nr: [1, 2, 20, 21], fc: 22 },
];

let _rulesPluralsTypes = {
  1: (n) => Number(n > 1),
  2: (n) => Number(n != 1),
  3: (n) => 0,
  4: (n) =>
    Number(
      n % 10 == 1 && n % 100 != 11
        ? 0
        : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20)
          ? 1
          : 2,
    ),
  5: (n) =>
    Number(
      n == 0
        ? 0
        : n == 1
          ? 1
          : n == 2
            ? 2
            : n % 100 >= 3 && n % 100 <= 10
              ? 3
              : n % 100 >= 11
                ? 4
                : 5,
    ),
  6: (n) => Number(n == 1 ? 0 : n >= 2 && n <= 4 ? 1 : 2),
  7: (n) =>
    Number(n == 1 ? 0 : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 1 : 2),
  8: (n) => Number(n == 1 ? 0 : n == 2 ? 1 : n != 8 && n != 11 ? 2 : 3),
  9: (n) => Number(n >= 2),
  10: (n) => Number(n == 1 ? 0 : n == 2 ? 1 : n < 7 ? 2 : n < 11 ? 3 : 4),
  11: (n) => Number(n == 1 || n == 11 ? 0 : n == 2 || n == 12 ? 1 : n > 2 && n < 20 ? 2 : 3),
  12: (n) => Number(n % 10 != 1 || n % 100 == 11),
  13: (n) => Number(n !== 0),
  14: (n) => Number(n == 1 ? 0 : n == 2 ? 1 : n == 3 ? 2 : 3),
  15: (n) =>
    Number(
      n % 10 == 1 && n % 100 != 11 ? 0 : n % 10 >= 2 && (n % 100 < 10 || n % 100 >= 20) ? 1 : 2,
    ),
  16: (n) => Number(n % 10 == 1 && n % 100 != 11 ? 0 : n !== 0 ? 1 : 2),
  17: (n) => Number(n == 1 || (n % 10 == 1 && n % 100 != 11) ? 0 : 1),
  18: (n) => Number(n == 0 ? 0 : n == 1 ? 1 : 2),
  19: (n) =>
    Number(
      n == 1
        ? 0
        : n == 0 || (n % 100 > 1 && n % 100 < 11)
          ? 1
          : n % 100 > 10 && n % 100 < 20
            ? 2
            : 3,
    ),
  20: (n) => Number(n == 1 ? 0 : n == 0 || (n % 100 > 0 && n % 100 < 20) ? 1 : 2),
  21: (n) => Number(n % 100 == 1 ? 1 : n % 100 == 2 ? 2 : n % 100 == 3 || n % 100 == 4 ? 3 : 0),
  22: (n) => Number(n == 1 ? 0 : n == 2 ? 1 : (n < 0 || n > 10) && n % 10 == 0 ? 2 : 3),
};
/* eslint-enable */

const nonIntlVersions = ['v1', 'v2', 'v3'];
const intlVersions = ['v4'];
const suffixesOrder = {
  zero: 0,
  one: 1,
  two: 2,
  few: 3,
  many: 4,
  other: 5,
};

const createRules = () => {
  const rules = {};
  sets.forEach((set) => {
    set.lngs.forEach((l) => {
      rules[l] = {
        numbers: set.nr,
        plurals: _rulesPluralsTypes[set.fc],
      };
    });
  });
  return rules;
};

class PluralResolver {
  constructor(languageUtils, options = {}, baseLogger) {
    this.languageUtils = languageUtils;
    this.options = options;

    this.logger = baseLogger.create('pluralResolver');

    if (
      (!this.options.compatibilityJSON || intlVersions.includes(this.options.compatibilityJSON)) &&
      (typeof Intl === 'undefined' || !Intl.PluralRules)
    ) {
      this.options.compatibilityJSON = 'v3';
      this.logger.error(
        'Your environment seems not to be Intl API compatible, use an Intl.PluralRules polyfill. Will fallback to the compatibilityJSON v3 format handling.',
      );
    }

    this.rules = createRules();

    // Cache calls to Intl.PluralRules, since repeated calls can be slow in runtimes like React Native
    // and the memory usage difference is negligible
    this.pluralRulesCache = {};
  }

  addRule(lng, obj) {
    this.rules[lng] = obj;
  }

  clearCache() {
    this.pluralRulesCache = {};
  }

  getRule(code, options = {}) {
    if (this.shouldUseIntlApi()) {
      const cleanedCode = getCleanedCode(code === 'dev' ? 'en' : code);
      const type = options.ordinal ? 'ordinal' : 'cardinal';
      const cacheKey = JSON.stringify({ cleanedCode, type });

      if (cacheKey in this.pluralRulesCache) {
        return this.pluralRulesCache[cacheKey];
      }

      let rule;

      try {
        rule = new Intl.PluralRules(cleanedCode, { type });
      } catch (err) {
        if (!code.match(/-|_/)) return;
        const lngPart = this.languageUtils.getLanguagePartFromCode(code);
        rule = this.getRule(lngPart, options);
      }

      this.pluralRulesCache[cacheKey] = rule;
      return rule;
    }

    return this.rules[code] || this.rules[this.languageUtils.getLanguagePartFromCode(code)];
  }

  needsPlural(code, options = {}) {
    const rule = this.getRule(code, options);

    if (this.shouldUseIntlApi()) {
      return rule && rule.resolvedOptions().pluralCategories.length > 1;
    }

    return rule && rule.numbers.length > 1;
  }

  getPluralFormsOfKey(code, key, options = {}) {
    return this.getSuffixes(code, options).map((suffix) => `${key}${suffix}`);
  }

  getSuffixes(code, options = {}) {
    const rule = this.getRule(code, options);

    if (!rule) {
      return [];
    }

    if (this.shouldUseIntlApi()) {
      return rule
        .resolvedOptions()
        .pluralCategories.sort(
          (pluralCategory1, pluralCategory2) =>
            suffixesOrder[pluralCategory1] - suffixesOrder[pluralCategory2],
        )
        .map(
          (pluralCategory) =>
            `${this.options.prepend}${
              options.ordinal ? `ordinal${this.options.prepend}` : ''
            }${pluralCategory}`,
        );
    }

    return rule.numbers.map((number) => this.getSuffix(code, number, options));
  }

  getSuffix(code, count, options = {}) {
    const rule = this.getRule(code, options);

    if (rule) {
      if (this.shouldUseIntlApi()) {
        return `${this.options.prepend}${
          options.ordinal ? `ordinal${this.options.prepend}` : ''
        }${rule.select(count)}`;
      }

      return this.getSuffixRetroCompatible(rule, count);
    }

    this.logger.warn(`no plural rule found for: ${code}`);
    return '';
  }

  getSuffixRetroCompatible(rule, count) {
    const idx = rule.noAbs ? rule.plurals(count) : rule.plurals(Math.abs(count));
    let suffix = rule.numbers[idx];

    // special treatment for lngs only having singular and plural
    if (this.options.simplifyPluralSuffix && rule.numbers.length === 2 && rule.numbers[0] === 1) {
      if (suffix === 2) {
        suffix = 'plural';
      } else if (suffix === 1) {
        suffix = '';
      }
    }

    const returnSuffix = () =>
      this.options.prepend && suffix.toString()
        ? this.options.prepend + suffix.toString()
        : suffix.toString();

    // COMPATIBILITY JSON
    // v1
    if (this.options.compatibilityJSON === 'v1') {
      if (suffix === 1) return '';
      if (typeof suffix === 'number') return `_plural_${suffix.toString()}`;
      return returnSuffix();
    } else if (/* v2 */ this.options.compatibilityJSON === 'v2') {
      return returnSuffix();
    } else if (
      /* v3 - gettext index */ this.options.simplifyPluralSuffix &&
      rule.numbers.length === 2 &&
      rule.numbers[0] === 1
    ) {
      return returnSuffix();
    }
    return this.options.prepend && idx.toString()
      ? this.options.prepend + idx.toString()
      : idx.toString();
  }

  shouldUseIntlApi() {
    return !nonIntlVersions.includes(this.options.compatibilityJSON);
  }
}

export default PluralResolver;
